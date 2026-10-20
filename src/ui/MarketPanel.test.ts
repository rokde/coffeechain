import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { sellAll } from '../app/market'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import { bankBuyPrice } from '../sim/market/market'
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
    const income = Math.round(10 * bankBuyPrice(game.state as GameState, 'robusta', 10) * 100)
    expect(income).toBe(398)
    sellAll(game, 'robusta')
    expect(game.state.storage.batches.filter((b) => b.variety === 'robusta')).toEqual([])
    expect(game.state.money).toBe(before + income)
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
