import { createPinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { useSavePanelStore } from '../app/savePanel'
import { startState } from '../app/resume'
import { pendingLoadError } from '../app/saves'
import { setStartState, useGameStore } from '../app/store'
import { deserialize, SAVE_VERSION, serialize } from '../sim/save/save'
import { createState, type GameState } from '../sim/state'
import { clock } from '../sim/time/time'
import Hud from './Hud.vue'
import SavePanel from './SavePanel.vue'

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }))

const PENDING = 'coffeechain.pendingLoad'
let local: Map<string, string>
let session: Map<string, string>
let reload: ReturnType<typeof vi.fn>
let replace: ReturnType<typeof vi.fn>

const storage = (items: Map<string, string>) => ({
  getItem: (k: string) => items.get(k) ?? null,
  setItem: (k: string, v: string) => void items.set(k, v),
  removeItem: (k: string) => void items.delete(k),
})

beforeEach(() => {
  local = new Map()
  session = new Map()
  reload = vi.fn()
  replace = vi.fn()
  vi.stubGlobal('localStorage', storage(local))
  vi.stubGlobal('sessionStorage', storage(session))
  vi.stubGlobal('location', { search: '?seed=42', pathname: '/', reload, replace })
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(invoke).mockReset()
  setStartState(null)
})

// main.ts reads the start state before it builds the stores.
async function start() {
  setStartState(await startState(location.search))
  return setup()
}

function setup() {
  const pinia = createPinia()
  return { pinia, game: useGameStore(pinia), panel: useSavePanelStore(pinia) }
}

const html = (pinia: Pinia, component = SavePanel) =>
  renderToString(createSSRApp(component).use(pinia))
const row = (text: string, slot: number) =>
  text.split(`data-testid="save-slot-${slot}"`)[1]!.split('</li>')[0]!
const status = (text: string) => text.match(/data-testid="save-slot-status"[^>]*>([^<]*)</)![1]
const loadButton = (text: string) =>
  text.match(/<button[^>]*data-testid="save-slot-load"[^>]*>/)![0]

describe('SavePanel (S42b)', () => {
  it('AC-1: the top bar has the save button, a click target opens three slot rows', async () => {
    const { pinia, panel } = setup()
    const closed = await html(pinia, Hud)
    const bar = closed.split('data-testid="hud-top-bar"')[1]!.split('</header>')[0]!
    expect(bar).toContain('data-testid="save-button"')
    expect(bar).toContain('aria-label="Spielstand"')
    expect(closed).not.toContain('data-testid="save-panel"')

    panel.open = true
    await panel.refresh()
    const open = await html(pinia, Hud)
    expect(open).toContain('data-testid="save-panel"')
    expect(open).toContain('role="dialog"')
    expect(open).toContain('data-testid="save-panel-close"')
    for (const slot of [1, 2, 3]) {
      const r = row(open, slot)
      expect(r).toContain('Speichern')
      expect(r).toContain('Laden')
      expect(status(r)).toBe('leer')
      expect(loadButton(r)).toContain('disabled')
    }
  })

  it('AC-2: save writes the current state and shows the game day', async () => {
    const { pinia, game, panel } = setup()
    const state = game.state as GameState
    game.replace({ ...state, time: { ...state.time, hour: 24 * 4 + 5 }, money: 777 })
    await panel.save('slot-2')
    expect(local.get('coffeechain.save.slot-2')).toBe(serialize(game.state as GameState))
    const r = row(await html(pinia), 2)
    expect(status(r)).toBe('Tag 5')
    expect(loadButton(r)).not.toContain('disabled')
    expect(status(row(await html(pinia), 1))).toBe('leer')

    await panel.load('slot-2')
    expect(session.get(PENDING)).toBe(local.get('coffeechain.save.slot-2'))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('AC-3: a slot that deserialize rejects shows "ungültig" and cannot load', async () => {
    local.set(
      'coffeechain.save.slot-3',
      JSON.stringify({ version: SAVE_VERSION, state: { money: 'a lot' } }),
    )
    local.set('coffeechain.save.slot-1', 'not json')
    const { pinia, panel } = setup()
    await panel.refresh()
    const text = await html(pinia)
    for (const slot of [1, 3]) {
      expect(status(row(text, slot))).toBe('ungültig')
      expect(loadButton(row(text, slot))).toContain('disabled')
    }
    expect(status(row(text, 2))).toBe('leer')
  })

  it.each([['disk full'], [new Error('disk full')]])(
    'AC-4: shows the reason when Tauri rejects with %o',
    async (reason) => {
      vi.mocked(isTauri).mockReturnValue(true)
      vi.mocked(invoke).mockRejectedValue(reason)
      const { pinia, panel } = setup()
      await expect(panel.save('slot-1')).resolves.toBeUndefined()
      expect(await html(pinia)).toContain('Speichern fehlgeschlagen: disk full')
      await expect(panel.refresh()).resolves.toBeUndefined()
      expect(await html(pinia)).toContain('Laden fehlgeschlagen: disk full')
      expect(status(row(await html(pinia), 1))).toBe('')
      panel.message = null
      await expect(panel.load('slot-1')).resolves.toBeUndefined()
      expect(await html(pinia)).toContain('Laden fehlgeschlagen: disk full')
      expect(reload).not.toHaveBeenCalled()
    },
  )

  it('AC-4: shows error text as text, not as HTML', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockRejectedValue('<b>/Users/x</b>')
    const { pinia, panel } = setup()
    await panel.save('slot-1')
    expect(await html(pinia)).toContain('&lt;b&gt;/Users/x&lt;/b&gt;')
  })

  it('AC-5: an invalid pending save starts a new game with the dialog open', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    session.set(PENDING, JSON.stringify({ version: SAVE_VERSION, state: { money: 1 } }))
    const { pinia, game, panel } = await start()
    expect(game.state).toEqual(createState(42))
    expect(pendingLoadError()).toMatch(/invalid/)
    expect(panel.open).toBe(true)
    expect(await html(pinia, Hud)).toContain('Der geladene Spielstand ist ungültig.')
  })

  it('AC-3 (#17): an old autosave at start shows the invalid-save message and a new game', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('location', { search: '', pathname: '/', reload, replace })
    const old = { ...createState(7), money: 4300 }
    local.set('coffeechain.save.autosave', JSON.stringify({ version: 10, state: old }))
    const { pinia, game, panel } = await start()
    expect(game.state).toEqual(createState(game.state.world.seed))
    expect(game.state.money).not.toBe(4300)
    expect(pendingLoadError()).toMatch(/unknown or old version/)
    expect(panel.open).toBe(true)
    expect(await html(pinia, Hud)).toContain('Der geladene Spielstand ist ungültig.')
  })

  it.each([
    ['no', null],
    ['a valid', serialize(createState(7))],
  ])('AC-5: with %s pending save the dialog is closed at start', async (_, text) => {
    if (text !== null) session.set(PENDING, text)
    const { pinia, panel } = await start()
    expect(pendingLoadError()).toBeNull()
    expect(panel.open).toBe(false)
    expect(await html(pinia, Hud)).not.toContain('data-testid="save-panel"')
  })

  it('S43 AC-3: the autosave row shows its day and loads, but has no save button', async () => {
    const autosaveRow = (text: string) =>
      text.split('data-testid="save-autosave"')[1]!.split('</li>')[0]!
    const { pinia, game, panel } = setup()
    await panel.refresh()
    let r = autosaveRow(await html(pinia))
    expect(r).toContain('Automatisch')
    expect(status(r)).toBe('leer')
    expect(loadButton(r)).toContain('disabled')
    expect(r).not.toContain('save-slot-save')
    expect(r).not.toContain('Speichern')

    const state = game.state as GameState
    local.set(
      'coffeechain.save.autosave',
      serialize({ ...state, time: { ...state.time, hour: 24 * 2 } }),
    )
    await panel.refresh()
    r = autosaveRow(await html(pinia))
    expect(status(r)).toBe('Tag 3')
    expect(loadButton(r)).not.toContain('disabled')

    await panel.load('autosave')
    expect(session.get(PENDING)).toBe(local.get('coffeechain.save.autosave'))
    expect(reload).toHaveBeenCalledOnce()
  })

  describe('S43b: new game', () => {
    const AUTOSAVE = 'coffeechain.save.autosave'
    const has = (text: string, id: string) => text.includes(`data-testid="${id}"`)

    it('AC-3: the button shows the confirm step, cancel hides it, and both write nothing', async () => {
      const { pinia, panel } = setup()
      let text = await html(pinia)
      expect(has(text, 'save-new-game')).toBe(true)
      expect(text).toContain('Neues Spiel')
      expect(has(text, 'save-new-game-confirm')).toBe(false)

      // The click handler of save-new-game.
      panel.confirmNewGame = true
      text = await html(pinia)
      expect(text).toContain('Das laufende Spiel geht verloren. Neues Spiel beginnen?')
      expect(has(text, 'save-new-game-confirm')).toBe(true)
      expect(has(text, 'save-new-game-cancel')).toBe(true)
      expect(text).toContain('Abbrechen')
      expect(text).toMatch(
        /<button[^>]*class="danger"[^>]*data-testid="save-new-game-confirm"[^>]*>\s*Ja, neues Spiel/,
      )
      expect(has(text, 'save-new-game')).toBe(false)
      expect(local.size).toBe(0)

      // The click handler of save-new-game-cancel.
      panel.confirmNewGame = false
      text = await html(pinia)
      expect(has(text, 'save-new-game-confirm')).toBe(false)
      expect(has(text, 'save-new-game')).toBe(true)
      expect(local.size).toBe(0)
      expect(reload).not.toHaveBeenCalled()
      expect(replace).not.toHaveBeenCalled()
    })

    it('AC-3: confirm pauses, writes a day-1 world to the autosave one time, then reloads', async () => {
      const { game, panel } = setup()
      const state = game.state as GameState
      game.replace({ ...state, time: { ...state.time, hour: 24 * 6, speed: 16 } })
      panel.confirmNewGame = true
      const setItem = vi.spyOn(localStorage, 'setItem')
      await panel.newGame()
      expect(setItem).toHaveBeenCalledOnce()
      expect(setItem.mock.calls[0]![0]).toBe(AUTOSAVE)
      const fresh = deserialize(local.get(AUTOSAVE)!)
      expect(clock(fresh.time.hour).day).toBe(1)
      expect(fresh.money).toBe(createState(1).money)
      expect([...local.keys()]).toEqual([AUTOSAVE])
      expect(game.state.time.speed).toBe(0)
      expect(reload).not.toHaveBeenCalled()
      // The path without ?seed=42, so the start reads the new autosave.
      expect(replace).toHaveBeenCalledExactlyOnceWith('/')
      expect(replace.mock.invocationCallOrder[0]).toBeGreaterThan(
        setItem.mock.invocationCallOrder[0]!,
      )
    })

    it('AC-3: a failed write shows the error and does not reload', async () => {
      vi.mocked(isTauri).mockReturnValue(true)
      vi.mocked(invoke).mockRejectedValue('disk full')
      const { pinia, game, panel } = setup()
      game.dispatch({ type: 'SetSpeed', speed: 4 })
      panel.confirmNewGame = true
      await expect(panel.newGame()).resolves.toBeUndefined()
      expect(game.state.time.speed).toBe(4)
      expect(replace).not.toHaveBeenCalled()
      expect(invoke).toHaveBeenCalledOnce()
      expect(invoke).toHaveBeenCalledWith('save_write', {
        slot: 'autosave',
        text: expect.any(String),
      })
      expect(reload).not.toHaveBeenCalled()
      const text = await html(pinia)
      expect(text).toMatch(
        /data-testid="save-panel-message"[^>]*>\s*Speichern fehlgeschlagen: disk full/,
      )
    })
  })
})
