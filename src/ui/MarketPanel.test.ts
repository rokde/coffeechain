import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { processAll, sellAll, sellAllWashed } from '../app/market'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import { bankBuyPrice, sellIncome } from '../sim/market/market'
import { processCost } from '../sim/processing/process'
import type { GameState } from '../sim/state'
import Hud from './Hud.vue'
import MarketPanel from './MarketPanel.vue'
import { tools } from './toolbar'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// A neutral market with 10 Robusta units in storage and 3 Robusta seeds.
function setup() {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  game.replace({
    ...state,
    storage: { ...state.storage, batches: [{ variety: 'robusta', units: 10, quality: 1 }] },
    market: { volumes: [], seeds: { robusta: 3 } },
  })
  return { pinia, game }
}

const block = (html: string, variety: string) =>
  html.split(`data-testid="market-${variety}"`)[1]!.split('</article>')[0]!
const field = (html: string, id: string) =>
  html.match(new RegExp(`data-testid="market-${id}"[^>]*>([^<]*)<`))![1]
const sellButton = (html: string) => html.match(/<button[^>]*data-testid="market-sell"[^>]*>/)![0]

describe('MarketPanel (S20)', () => {
  it('AC-1: the toolbar ends with the market tool', () => {
    expect(tools.at(-1)).toEqual({ id: 'market', label: 'Markt', key: 'M' })
  })

  it('AC-1: the right panel shows the market panel and no inspector for the market tool', async () => {
    const { pinia } = setup()
    const selection = useSelectionStore(pinia)
    selection.parcel = { x: 1, y: 1 }
    selection.tool = 'market'
    const html = await renderToString(createSSRApp({ render: () => h(Hud) }).use(pinia))
    const panel = html.split('data-testid="hud-right-panel"')[1]!.split('</aside>')[0]!
    expect(panel).toContain('data-testid="market-panel"')
    expect(html).not.toContain('parcel-inspector')
  })

  it('AC-3: shows stock, seeds and prices for the unlocked varieties only', async () => {
    const { pinia } = setup()
    const html = await renderToString(createSSRApp(MarketPanel).use(pinia))
    const robusta = block(html, 'robusta')
    expect(robusta).toContain('Robusta')
    expect(field(robusta, 'stock')).toBe('10')
    expect(field(robusta, 'seeds')).toBe('3')
    expect(field(robusta, 'sell-price')).toBe('0,4 CC')
    expect(field(robusta, 'buy-price')).toBe('2 CC')
    const arabica = block(html, 'arabicaStandard')
    expect(arabica).toContain('Arabica Standard')
    expect(field(arabica, 'sell-price')).toBe('0,8 CC')
    expect(field(arabica, 'buy-price')).toBe('4 CC')
    expect(html).not.toContain('market-arabicaPremium')
    expect(html).not.toContain('market-specialty')
    expect(html).not.toContain('Arabica Premium')
    expect(html).not.toContain('Specialty')
  })

  it('S57 round 1: names the unit prices as per unit', async () => {
    const { pinia } = setup()
    const robusta = block(await renderToString(createSSRApp(MarketPanel).use(pinia)), 'robusta')
    expect(robusta).toContain('>Bank zahlt je Einheit</dt>')
    expect(robusta).toContain('>Saatgut kostet je Einheit</dt>')
    expect(robusta).toContain('>Bank zahlt (gewaschen) je Einheit</dt>')
  })

  it('S63 AC-1..3: the hint states the real storage cost rule', async () => {
    const { pinia } = setup()
    const html = await renderToString(createSSRApp(MarketPanel).use(pinia))
    const n = Math.round(1 / balance().storage.costPerUnitPerDay)
    const hint = field(html, 'hint')!
    expect(hint).toContain(`Das Lager kostet jeden Tag 1 CC je angefangene ${n} Einheiten.`)
    expect(hint).toContain('Ein leeres Lager kostet nichts.')
    expect(hint).not.toContain('mindestens')
    expect(hint).not.toContain('{units}')
  })

  it('S57 round 1: "Verkaufen" shows the whole income that sell books', async () => {
    const { pinia, game } = setup()
    const html = await renderToString(createSSRApp(MarketPanel).use(pinia))
    const income = sellIncome(game.state as GameState, 'robusta', 10)
    expect(income).toBe(300)
    expect(field(block(html, 'robusta'), 'sell')!.trim()).toBe(
      'Verkaufen (10\u00a0Einh., 3\u00a0CC)',
    )
    expect(sellButton(block(html, 'robusta'))).not.toContain('title=')
    expect(field(block(html, 'arabicaStandard'), 'sell')!.trim()).toBe('Verkaufen')
    const before = game.state.money
    sellAll(game, 'robusta')
    expect(game.state.money).toBe(before + income)
  })

  it('S61 AC-1/AC-4: a sale that pays 0 CC disables the button and shows why', async () => {
    const { pinia, game } = setup()
    const state = game.state as GameState
    game.replace({ ...state, storage: { batches: [{ variety: 'robusta', units: 2, quality: 1 }] } })
    const html = block(await renderToString(createSSRApp(MarketPanel).use(pinia)), 'robusta')
    expect(field(html, 'sell')!.trim()).toBe('Verkaufen (2\u00a0Einh., 0\u00a0CC)')
    expect(sellButton(html)).toContain('disabled')
    expect(sellButton(html)).not.toContain('title')
    expect(sellButton(html)).toContain('aria-describedby="market-sell-why-robusta"')
    expect(html).toMatch(
      /<p[^>]*id="market-sell-why-robusta"[^>]*data-testid="market-sell-why"[^>]*>\s*Menge zu klein\s*</,
    )
  })

  it('S61 AC-2/AC-4: washed units that pay 0 CC disable the washed button and show why', async () => {
    const { pinia, game } = setup()
    const washed = { variety: 'robusta' as const, units: 1, quality: 1, washed: true as const }
    game.replace({ ...(game.state as GameState), storage: { batches: [washed] } })
    const html = block(await renderToString(createSSRApp(MarketPanel).use(pinia)), 'robusta')
    const btn = html.match(/<button[^>]*data-testid="market-sell-washed"[^>]*>/)![0]
    expect(btn).toContain('disabled')
    expect(btn).not.toContain('title')
    expect(btn).toContain('aria-describedby="market-sell-washed-why-robusta"')
    expect(html).toMatch(
      /id="market-sell-washed-why-robusta"[^>]*data-testid="market-sell-washed-why"[^>]*>\s*Menge zu klein\s*</,
    )
  })

  it('S61 AC-3: 10 units stay sellable without a line, 0 units show no line', async () => {
    const { pinia } = setup()
    const html = await renderToString(createSSRApp(MarketPanel).use(pinia))
    expect(sellButton(block(html, 'robusta'))).not.toContain('disabled')
    expect(html).not.toContain('Menge zu klein')
    expect(sellButton(block(html, 'arabicaStandard'))).toContain('disabled')
  })

  it('AC-4: each block has two flat lines with historyDays points', async () => {
    const { pinia } = setup()
    const html = await renderToString(createSSRApp(MarketPanel).use(pinia))
    for (const variety of ['robusta', 'arabicaStandard']) {
      const lines = [...block(html, variety).matchAll(/<polyline[^>]*points="([^"]*)"/g)]
      expect(lines).toHaveLength(2)
      for (const [, points] of lines) {
        const ys = points!.split(' ').map((p) => p.split(',')[1])
        expect(ys).toHaveLength(balance().market.historyDays)
        expect(ys).toHaveLength(14)
        expect(new Set(ys).size).toBe(1)
      }
    }
  })

  it('AC-5: disables "Verkaufen" when the variety has no stock', async () => {
    const { pinia } = setup()
    const html = await renderToString(createSSRApp(MarketPanel).use(pinia))
    expect(sellButton(block(html, 'robusta'))).not.toContain('disabled')
    expect(sellButton(block(html, 'arabicaStandard'))).toContain('disabled')
  })

  it('AC-5: the sell action sells all Robusta units at the bank price', () => {
    const { game } = setup()
    const before = game.state.money
    // The 10 units sell at the price of the mid volume of 5 units.
    // S57: 3.98 CC rounds down to 3 CC.
    expect(10 * bankBuyPrice(game.state as GameState, 'robusta', 10)).toBeCloseTo(3.98)
    const income = 300
    sellAll(game, 'robusta')
    expect(game.state.storage.batches.filter((b) => b.variety === 'robusta')).toEqual([])
    expect(game.state.money).toBe(before + income)
  })
})

describe('MarketPanel processing (S46)', () => {
  // A farm with 60 raw Arabica Standard units, with or without a processing building.
  function processing(building: boolean) {
    const pinia = createPinia()
    const game = useGameStore(pinia)
    const state = game.state as GameState
    game.replace({
      ...state,
      buildings: building ? { 0: { kind: 'processing' } } : {},
      storage: { batches: [{ variety: 'arabicaStandard', units: 60, quality: 100 }] },
    })
    return { pinia, game }
  }
  const render = async (pinia: ReturnType<typeof createPinia>) =>
    block(await renderToString(createSSRApp(MarketPanel).use(pinia)), 'arabicaStandard')
  const button = (html: string, id: string) =>
    html.match(new RegExp(`<button[^>]*data-testid="market-${id}"[^>]*>`))![0]

  it('AC-5: "Aufbereiten" processes 50 units, then shows the running line and disables the button', async () => {
    const { pinia, game } = processing(true)
    let html = await render(pinia)
    expect(button(html, 'process')).not.toContain('disabled')
    expect(button(html, 'process')).not.toContain('title')
    expect(field(html, 'process')!.trim()).toBe('Aufbereiten (50\u00a0Einh., 15\u00a0CC)')
    expect(button(html, 'sell-washed')).toContain('disabled')
    expect(html).not.toContain('market-processing')
    const dispatch = vi.spyOn(game, 'dispatch')
    processAll(game, 'arabicaStandard')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'Process',
      variety: 'arabicaStandard',
      units: 50,
    })
    html = await render(pinia)
    expect(field(html, 'stock')).toBe('10')
    expect(field(html, 'washed-stock')).toBe('0')
    expect(field(html, 'processing')!.trim()).toBe('Aufbereitung läuft bis Tag 2')
    expect(button(html, 'process')).toContain('disabled')
    expect(button(html, 'process')).toContain('title="Es läuft schon eine Aufbereitung."')
    expect(button(html, 'sell-washed')).toContain('disabled')
  })

  it('AC-5: after one day the washed units show and sell at the washed price', async () => {
    const { pinia, game } = processing(true)
    processAll(game, 'arabicaStandard')
    game.replace({ ...(game.state as GameState), time: { hour: 24, speed: 1 } })
    const html = await render(pinia)
    expect(field(html, 'washed-stock')).toBe('50')
    expect(field(html, 'washed-sell-price')).toBe('1,2 CC')
    expect(html).not.toContain('market-processing')
    expect(button(html, 'sell-washed')).not.toContain('disabled')
    const income = sellIncome(game.state as GameState, 'arabicaStandard', 50, true)
    expect(field(html, 'sell-washed')!.trim()).toBe(
      `Gewaschen verkaufen (50\u00a0Einh., ${income / 100}\u00a0CC)`,
    )
    const before = game.state.money
    sellAllWashed(game, 'arabicaStandard')
    expect(game.state.money).toBe(before + income)
    expect(game.state.storage.batches).toEqual([
      { variety: 'arabicaStandard', units: 10, quality: 100 },
    ])
  })

  it('AC-5: disables "Aufbereiten" without a processing building and says why', async () => {
    const { pinia } = processing(false)
    const html = button(await render(pinia), 'process')
    expect(html).toContain('disabled')
    expect(html).toContain('title="Baue zuerst eine Aufbereitung."')
    expect(html).toContain(
      'aria-label="Aufbereiten (50\u00a0Einh., 15\u00a0CC). Baue zuerst eine Aufbereitung."',
    )
  })

  it('S46: names no raw stock and too little money as reasons', async () => {
    const { pinia, game } = processing(true)
    const state = game.state as GameState
    game.replace({ ...state, money: 1499 })
    expect(button(await render(pinia), 'process')).toContain('title="Zu wenig Geld."')
    game.replace({ ...state, storage: { batches: [] } })
    const html = await render(pinia)
    expect(button(html, 'process')).toContain('title="Kein Rohkaffee im Lager."')
    expect(field(html, 'process')!.trim()).toBe('Aufbereiten')
  })

  it('S57 AC-5: the button shows the whole cost from processCost, the unit prices keep decimals', async () => {
    const { pinia, game } = processing(true)
    const state = game.state as GameState
    const batches = [{ variety: 'arabicaStandard' as const, units: 7, quality: 100 }]
    // 15 sold units lower the bank price to 0.8 × (1 − 0.3 × 15 / 300) = 0.788 CC.
    const volumes = [
      { kind: 'coffee' as const, variety: 'arabicaStandard' as const, day: 1, units: 15 },
    ]
    game.replace({ ...state, money: 300, storage: { batches }, market: { volumes, seeds: {} } })
    let html = await render(pinia)
    expect(processCost(7)).toBe(300)
    expect(field(html, 'process')!.trim()).toBe('Aufbereiten (7\u00a0Einh., 3\u00a0CC)')
    expect(button(html, 'process')).not.toContain('disabled')
    expect(field(html, 'sell-price')).toBe('0,79 CC')
    game.replace({ ...(game.state as GameState), money: 200 })
    html = await render(pinia)
    expect(button(html, 'process')).toContain('title="Zu wenig Geld."')
  })

  it('S46: keeps a locked variety with only washed units in the panel', async () => {
    const { pinia, game } = processing(true)
    const washed = {
      variety: 'arabicaPremium' as const,
      units: 5,
      quality: 90,
      washed: true as const,
    }
    game.replace({ ...(game.state as GameState), storage: { batches: [washed] } })
    expect(await renderToString(createSSRApp(MarketPanel).use(pinia))).toContain(
      'data-testid="market-arabicaPremium"',
    )
  })
})

describe('MarketPanel varieties (S48)', () => {
  const render = (patch: (state: GameState) => GameState) => {
    const pinia = createPinia()
    const game = useGameStore(pinia)
    game.replace(patch(game.state as GameState))
    return renderToString(createSSRApp(MarketPanel).use(pinia))
  }

  it('AC-5: hides Arabica Premium in a new game', async () => {
    const html = await render((s) => s)
    expect(html).toContain('data-testid="market-robusta"')
    expect(html).not.toContain('data-testid="market-arabicaPremium"')
  })

  it('AC-5: shows Arabica Premium with stock of it', async () => {
    const html = await render((s) => ({
      ...s,
      storage: { ...s.storage, batches: [{ variety: 'arabicaPremium', units: 1, quality: 1 }] },
    }))
    expect(html).toContain('data-testid="market-arabicaPremium"')
    expect(html).not.toContain('data-testid="market-specialty"')
  })

  it('AC-5: shows Arabica Premium when it is unlocked', async () => {
    const html = await render((s) => ({ ...s, money: 200000 }))
    expect(html).toContain('data-testid="market-arabicaPremium"')
    expect(html).not.toContain('data-testid="market-specialty"')
  })
})
