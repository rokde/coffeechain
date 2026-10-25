import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useSaveListStore } from '../app/saveList'
import { useStartScreenStore } from '../app/startScreen'
import { deserialize, serialize } from '../sim/save/save'
import { createState, type GameState } from '../sim/state'
import StartScreen from './StartScreen.vue'

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }))

const NOW = 1_700_000_000_000
let local: Map<string, string>

beforeEach(() => {
  local = new Map()
  vi.stubGlobal('localStorage', { getItem: (k: string) => local.get(k) ?? null })
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
  return () => vi.useRealTimers()
})

const at = (seed: number, day: number, money: number): GameState => {
  const state = createState(seed)
  return { ...state, time: { ...state.time, day }, money }
}
const v12 = (state: GameState) => JSON.stringify({ version: 12, state })

async function render(slots: Record<string, string>) {
  for (const [slot, text] of Object.entries(slots)) local.set(`coffeechain.save.${slot}`, text)
  const pinia = createPinia()
  const screen = useStartScreenStore(pinia)
  const auto = slots.autosave
  screen.save = auto ? deserialize(auto) : null
  await useSaveListStore(pinia).refresh()
  return renderToString(createSSRApp(StartScreen).use(pinia))
}
// The text of a card without tags and with single spaces.
const card = (html: string, slot: string) => {
  const part = html.split(`data-testid="save-card-${slot}"`)[1]!.split('</li>')[0]!
  return part
    .replace(/^[^>]*>/, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
const opening = (html: string, slot: string) =>
  html.match(new RegExp(`<(\\w+)[^>]*data-testid="save-card-${slot}"`))![1]

describe('SaveList (#3)', () => {
  it('AC-4: shows four cards in order with date, world, CC and time', async () => {
    const html = await render({
      autosave: serialize(at(48213, 70, 124000), NOW - 3 * 60_000),
      'slot-1': v12(at(777, 431, 50000)),
      'slot-2': '{broken',
    })
    expect(html).toContain('data-testid="save-list"')
    expect(html).toContain('Spielstände')
    expect(card(html, 'autosave')).toBe(
      'Automatisch 11. März, Jahr 1 Welt #48213 · 1.240 CC vor 3 Minuten',
    )
    expect(card(html, 'slot-1')).toBe('Platz 1 12. März, Jahr 2 Welt #777 · 500 CC')
    expect(card(html, 'slot-2')).toBe('Platz 2 ungültig')
    expect(card(html, 'slot-3')).toBe('Platz 3 leer')
    const order = ['autosave', 'slot-1', 'slot-2', 'slot-3'].map((s) =>
      html.indexOf(`save-card-${s}"`),
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(html).toMatch(/data-testid="start-last-played"[^>]*>Zuletzt gespielt vor 3 Minuten</)
  })

  it('AC-5: only the readable cards are buttons', async () => {
    const html = await render({
      autosave: serialize(at(48213, 70, 124000), NOW),
      'slot-1': v12(at(777, 431, 50000)),
      'slot-2': '{broken',
    })
    expect(opening(html, 'autosave')).toBe('button')
    expect(opening(html, 'slot-1')).toBe('button')
    expect(opening(html, 'slot-2')).toBe('div')
    expect(opening(html, 'slot-3')).toBe('div')
  })

  it('AC-4: a version 12 autosave shows no last played line', async () => {
    const html = await render({ autosave: v12(at(48213, 70, 124000)) })
    expect(html).toContain('Willkommen zurück')
    expect(html).not.toContain('start-last-played')
    expect(card(html, 'autosave')).toBe('Automatisch 11. März, Jahr 1 Welt #48213 · 1.240 CC')
  })

  it('AC-4: with all slots empty there is no save list', async () => {
    const html = await render({})
    expect(html).not.toContain('save-list')
    expect(html).not.toContain('Spielstände')
  })

  it('shows the list in the new-game view when only a slot has a save', async () => {
    const html = await render({ 'slot-3': serialize(at(5, 0, 100), NOW) })
    expect(html).toContain('data-testid="start-seed"')
    expect(card(html, 'slot-3')).toBe('Platz 3 1. Januar, Jahr 1 Welt #5 · 1 CC gerade eben')
  })
})
