import { createPinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { useSavePanelStore } from '../app/savePanel'
import { pendingLoadError } from '../app/saves'
import { useGameStore } from '../app/store'
import { serialize } from '../sim/save/save'
import { createState, type GameState } from '../sim/state'
import Hud from './Hud.vue'
import SavePanel from './SavePanel.vue'

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }))

const PENDING = 'coffeechain.pendingLoad'
let local: Map<string, string>
let session: Map<string, string>
let reload: ReturnType<typeof vi.fn>

const storage = (items: Map<string, string>) => ({
  getItem: (k: string) => items.get(k) ?? null,
  setItem: (k: string, v: string) => void items.set(k, v),
  removeItem: (k: string) => void items.delete(k),
})

beforeEach(() => {
  local = new Map()
  session = new Map()
  reload = vi.fn()
  vi.stubGlobal('localStorage', storage(local))
  vi.stubGlobal('sessionStorage', storage(session))
  vi.stubGlobal('location', { search: '?seed=42', reload })
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(invoke).mockReset()
})

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
    local.set('coffeechain.save.slot-3', JSON.stringify({ version: 1, state: { money: 'a lot' } }))
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
    session.set(PENDING, JSON.stringify({ version: 1, state: { money: 1 } }))
    const { pinia, game, panel } = setup()
    expect(game.state).toEqual(createState(42))
    expect(pendingLoadError()).toMatch(/invalid/)
    expect(panel.open).toBe(true)
    expect(await html(pinia, Hud)).toContain(
      'Der geladene Spielstand ist ungültig. Ein neues Spiel hat begonnen.',
    )
  })

  it.each([
    ['no', null],
    ['a valid', serialize(createState(7))],
  ])('AC-5: with %s pending save the dialog is closed at start', async (_, text) => {
    if (text !== null) session.set(PENDING, text)
    const { pinia, panel } = setup()
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
})
