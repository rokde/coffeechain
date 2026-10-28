import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useStartScreenStore } from '../app/startScreen'
import { createState } from '../sim/state'
import { islandFacts } from '../sim/world/facts'
import de from './i18n/de.json'
import StartScreen from './StartScreen.vue'

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }))

function render(setup: (screen: ReturnType<typeof useStartScreenStore>) => void) {
  const pinia = createPinia()
  setup(useStartScreenStore(pinia))
  return renderToString(createSSRApp(StartScreen).use(pinia))
}
const has = (html: string, id: string) => html.includes(`data-testid="${id}"`)
const text = (html: string, id: string) =>
  html.match(new RegExp(`data-testid="${id}"[^>]*>([^<]*)<`))![1]!

describe('StartScreen (#3)', () => {
  it('AC-1: without a save it shows the seed field, the reroll button and "Spiel starten"', async () => {
    const html = await render((s) => (s.seedText = '48213'))
    expect(html).toContain('CoffeeChain')
    expect(html).toContain('Deine Insel')
    expect(html).toMatch(
      /<input[^>]*value="48213"[^>]*data-testid="start-seed"[^>]*inputmode="numeric"/,
    )
    expect(html).toMatch(/data-testid="start-reroll"[^>]*aria-label="Neuer Seed"/)
    expect(html).toMatch(/<button type="submit"[^>]*data-testid="start-play"[^>]*>\s*Spiel starten/)
    expect(html).not.toMatch(/data-testid="start-play"[^>]*disabled/)
    expect(has(html, 'start-continue')).toBe(false)
    expect(has(html, 'start-back')).toBe(false)
    expect(has(html, 'hud-top-bar')).toBe(false)
  })

  it('an invalid seed disables "Spiel starten" and marks the field', async () => {
    const html = await render((s) => (s.seedText = '4294967296'))
    expect(html).toMatch(/data-testid="start-play" disabled/)
    expect(html).toMatch(/aria-invalid="true"/)
  })

  it('AC-3: with a save it shows the date, the world and the CC', async () => {
    const state = createState(48213)
    const html = await render((s) => {
      s.save = { ...state, time: { ...state.time, day: 70 }, money: 124000 }
    })
    expect(html).toContain('Willkommen zurück')
    expect(text(html, 'start-save-date')).toBe('11. März, Jahr 1')
    expect(text(html, 'start-save-world')).toBe('Welt #48213')
    expect(text(html, 'start-save-money')).toBe('1.240 CC')
    expect(html).toMatch(/data-testid="start-continue"[^>]*>[\s\S]*Weiterspielen/)
    expect(text(html, 'start-new-game').trim()).toBe('Neues Spiel')
    expect(has(html, 'start-seed')).toBe(false)
  })

  it('AC-4: the confirm step shows the warning, and a confirmed new game shows the seed field', async () => {
    const save = createState(7)
    let html = await render((s) => {
      s.save = save
      s.confirmNewGame = true
    })
    expect(html).toContain('Das laufende Spiel geht verloren. Neues Spiel beginnen?')
    expect(has(html, 'start-new-game-confirm')).toBe(true)
    expect(text(html, 'start-new-game-cancel').trim()).toBe('Abbrechen')
    expect(has(html, 'start-continue')).toBe(false)
    html = await render((s) => {
      s.save = save
      s.newGame = true
    })
    expect(has(html, 'start-seed')).toBe(true)
    expect(has(html, 'start-play')).toBe(true)
    expect(has(html, 'start-continue')).toBe(false)
    expect(text(html, 'start-back').trim()).toBe('Zurück zum Spielstand')
  })
})

describe('StartScreen island facts (#3)', () => {
  const zoneLine = (html: string, z: string) => text(html, `start-zone-${z}`).trim()

  it('AC-3: shows the zone shares of the seed', async () => {
    const { shares } = islandFacts(createState(48213).world)
    const html = await render((s) => (s.seedText = '48213'))
    expect(zoneLine(html, 'tiefland')).toBe(`Tiefland ${shares.tiefland} %`)
    expect(zoneLine(html, 'hochland')).toBe(`Hochland ${shares.hochland} %`)
    expect(zoneLine(html, 'hochlandKuehl')).toBe(`Kühles Hochland ${shares.hochlandKuehl} %`)
  })

  it('AC-4: the hut hint follows the seed', async () => {
    const hint = async (seed: number) => {
      const { hut } = islandFacts(createState(seed).world)
      const zone = de.inspector.zones[hut.zone]
      const soil = de.inspector.soilClasses[hut.soilClass]
      const html = await render((s) => (s.seedText = String(seed)))
      expect(text(html, 'start-hut')).toBe(
        `Deine Hütte steht im ${zone} bei ${hut.x} / ${hut.y}, Boden ${soil}.`,
      )
      return text(html, 'start-hut')
    }
    expect(await hint(48213)).not.toBe(await hint(7))
  })

  it('AC-5: no facts for an invalid seed or on the welcome view', async () => {
    let html = await render((s) => (s.seedText = '4294967296'))
    expect(has(html, 'start-zone-tiefland')).toBe(false)
    expect(has(html, 'start-hut')).toBe(false)
    html = await render((s) => (s.save = createState(7)))
    expect(has(html, 'start-zone-tiefland')).toBe(false)
    expect(has(html, 'start-hut')).toBe(false)
  })
})
