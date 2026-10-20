import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useFirstStepsStore } from '../app/firstSteps'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import type { EventType, GameEvent } from '../sim/events/schedule'
import type { GameState } from '../sim/state'
import Hud from './Hud.vue'
import de from './i18n/de.json'
import MessagePanel from './MessagePanel.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// Game day 5 starts at this hour.
const DAY = 5
const hour = (DAY - 1) * balance().time.ticksPerGameDay

const event = (type: EventType, startDay: number, endDay = startDay + 3): GameEvent => ({
  type,
  announcedDay: startDay - 2,
  startDay,
  endDay,
})

function setup(events: GameEvent[]) {
  const pinia = createPinia()
  useFirstStepsStore(pinia).open = false
  const game = useGameStore(pinia)
  const state = game.state as GameState
  game.replace({ ...state, time: { ...state.time, hour }, events })
  return pinia
}

const topBar = async (events: GameEvent[]) => {
  const html = await renderToString(createSSRApp(Hud).use(setup(events)))
  return html.split('data-testid="hud-top-bar"')[1]!.split('</header>')[0]!
}
const chips = (html: string) =>
  [...html.matchAll(/data-testid="active-event"[^>]*>([^<]*)</g)].map((m) => m[1])

const panel = (events: GameEvent[]) => renderToString(createSSRApp(MessagePanel).use(setup(events)))
const items = (html: string) =>
  [...html.matchAll(/data-testid="message"[^>]*>(.*?)<\/li>/g)].map((m) =>
    m[1]!
      .replace(/<[^>]*>/g, ' ')
      .trim()
      .replace(/\s+/g, ' '),
  )

describe('Event HUD (S52)', () => {
  it('AC-1: an active frost event gives one "Frost" chip, no event gives none', async () => {
    expect(chips(await topBar([event('frost', DAY)]))).toEqual(['Frost'])
    expect(chips(await topBar([event('frost', DAY - 2, DAY + 1)]))).toEqual(['Frost'])
    expect(await topBar([])).not.toContain('active-event')
    expect(await topBar([event('frost', DAY - 3, DAY)])).not.toContain('active-event')
  })

  it('AC-2: frost and boom give two chips, a warned event gives none', async () => {
    const html = await topBar([
      event('frost', DAY),
      event('boom', DAY - 1),
      event('pests', DAY + 1),
    ])
    expect(chips(html)).toEqual(['Frost', 'Marktboom'])
  })

  it('AC-3: a warned frost event comes first with "ab morgen" or "ab Tag {day}"', async () => {
    const hint = de.events.frost.hint
    const a = await panel([event('frost', DAY + 1)])
    expect(items(a)[0]).toBe(`Frost-Warnung ab morgen ${hint}`)
    const b = await panel([event('frost', DAY + 2)])
    expect(items(b)[0]).toBe(`Frost-Warnung ab Tag ${DAY + 2} ${hint}`)
  })

  it('AC-3: warnings are sorted by start day', async () => {
    const html = await panel([event('monsoon', DAY + 2), event('frost', DAY + 1)])
    expect(items(html).map((t) => t.split(' ab ')[0])).toEqual(['Frost-Warnung', 'Monsun-Warnung'])
  })

  it('AC-4: a warned pests event shows the care hint, an active event gives no warning', async () => {
    const html = await panel([event('pests', DAY + 1)])
    expect(items(html)[0]).toContain(de.events.pests.warning)
    expect(html).toContain('Schädlingsschutz halbiert den Verlust im Tiefland.')
    expect(html).toContain('„Schützen“')
    const active = await panel([event('pests', DAY)])
    expect(active).not.toContain(de.events.pests.warning)
    expect(active).not.toContain(de.events.pests.hint)
  })

  it('AC-5: every timed event type has a name, a warning and a hint', () => {
    // The type fails typecheck when an EventType has no texts.
    const texts: Record<EventType, { name: string; warning: string; hint: string }> = de.events
    const types: EventType[] = ['frost', 'monsoon', 'boom', 'crisis', 'pests']
    for (const type of types) {
      for (const text of Object.values(texts[type])) expect(text.trim()).not.toBe('')
    }
  })
})
