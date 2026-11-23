import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { dispatch } from '../sim/commands'
import type { Batch } from '../sim/storage/storage'
import type { GameState } from '../sim/state'
import Hud from './Hud.vue'
import MarketPanel from './MarketPanel.vue'
import MarketSeed from './market/MarketSeed.vue'
import { tabKey } from './market/tablist'
import { tools } from './toolbar'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// A neutral market with the given batches and 3 Robusta seeds.
function setup(batches: Batch[] = [{ variety: 'robusta', units: 10, quality: 1, storedDay: 0 }]) {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  game.replace({
    ...state,
    storage: { ...state.storage, batches },
    market: { volumes: {}, seeds: { robusta: 3 } },
  })
  return { pinia, game }
}

const render = (pinia: ReturnType<typeof createPinia>) =>
  renderToString(createSSRApp(MarketPanel).use(pinia))
const row = (html: string, key: string) =>
  html.split(`data-testid="bank-row-${key}"`)[1]!.split('data-testid="bank-row-')[0]!
const text = (html: string, id: string) =>
  html
    .match(new RegExp(`data-testid="${id}"[^>]*>([\\s\\S]*?)</`))![1]!
    .replace(/<!--.*?-->/g, '')
    .trim()

describe('MarketPanel shell (#20)', () => {
  it('the toolbar ends with the market tool', () => {
    expect(tools.at(-1)).toMatchObject({ id: 'market', label: 'Markt', key: 'M' })
  })

  it('the right panel shows the wide market panel and no inspector for the market tool', async () => {
    const { pinia } = setup()
    const selection = useSelectionStore(pinia)
    selection.parcel = { x: 1, y: 1 }
    selection.tool = 'market'
    const html = await renderToString(createSSRApp({ render: () => h(Hud) }).use(pinia))
    const aside = html.match(/<aside[^>]*data-testid="hud-right-panel"[^>]*>/)![0]
    expect(aside).toContain('wide')
    const panel = html.split('data-testid="hud-right-panel"')[1]!.split('</aside>')[0]!
    expect(panel).toContain('data-testid="market-panel"')
    expect(html).not.toContain('parcel-inspector')
  })

  it('other tools keep the narrow right panel', async () => {
    const { pinia } = setup()
    useSelectionStore(pinia).tool = 'build'
    const html = await renderToString(createSSRApp({ render: () => h(Hud) }).use(pinia))
    expect(html.match(/<aside[^>]*data-testid="hud-right-panel"[^>]*>/)![0]).not.toContain('wide')
  })

  it('has a title, a close button and three tabs with "Bank" selected', async () => {
    const { pinia } = setup()
    const html = await render(pinia)
    expect(html).toContain('<h2 class="title"')
    expect(html).toMatch(/<button[^>]*data-testid="market-close"[^>]*aria-label="Markt schließen"/)
    expect(html).toContain('role="tablist" aria-label="Bereiche des Markts"')
    const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0])
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toContain('aria-selected="true"')
    expect(tabs[0]).toContain('tabindex="0"')
    expect(tabs[1]).toContain('aria-selected="false"')
    expect(tabs[1]).toContain('tabindex="-1"')
    expect(html).toContain('>Bank<')
    expect(html).toContain('Aufträge')
    expect(html).toContain('>Saatgut<')
    expect(html).toMatch(/role="tabpanel" aria-labelledby="market-tab-bank"/)
    expect(html).toContain('data-testid="market-bank"')
    expect(html).not.toContain('data-testid="orders-panel"')
  })

  it('counts the open orders on the tab and marks it when one is deliverable', async () => {
    const { pinia, game } = setup([{ variety: 'robusta', units: 30, quality: 90, storedDay: 0 }])
    const order = {
      id: 1,
      variety: 'robusta' as const,
      units: 20,
      minQuality: 50,
      price: 50,
      deadlineDay: 90,
    }
    game.replace({
      ...(game.state as GameState),
      orders: { ...game.state.orders, open: [order, { ...order, id: 2, units: 99 }] },
    })
    const count = (await render(pinia)).match(
      /<span[^>]*data-testid="market-orders-count"[^>]*>[^<]*</,
    )![0]
    expect(count).toMatch(/class="(go count|count go)"/)
    expect(count).toContain('title="2 Aufträge, 1 lieferbar"')
    expect(count).toMatch(/>2<$/)
  })

  it('arrow keys, Home and End move between the tabs and wrap', () => {
    expect(tabKey('ArrowRight', 0, 3)).toBe(1)
    expect(tabKey('ArrowRight', 2, 3)).toBe(0)
    expect(tabKey('ArrowLeft', 0, 3)).toBe(2)
    expect(tabKey('Home', 2, 3)).toBe(0)
    expect(tabKey('End', 0, 3)).toBe(2)
    expect(tabKey('Enter', 1, 3)).toBeNull()
    expect(tabKey('a', 1, 3)).toBeNull()
  })
})

describe('MarketPanel bank list (#20)', () => {
  it('shows one row per variety and state with stock, price, share of the reference and trend', async () => {
    const { pinia } = setup()
    const html = await render(pinia)
    expect(html).toContain('Die Bank kauft immer.')
    expect(html).toContain('in 30 Tagen um die Hälfte')
    const raw = row(html, 'robusta-raw')
    expect(text(raw, 'bank-stock')).toBe('10')
    expect(text(raw, 'bank-price')).toBe('0,40 CC')
    expect(raw).toContain('100 % der Referenz')
    expect(text(raw, 'bank-trend')).toBe('▶ ±0 %')
    expect(raw).toContain('>roh<')
    const washed = row(html, 'robusta-washed')
    expect(washed).toContain('nichts im Lager')
    expect(washed).toMatch(/<button[^>]*class="grow"[^>]*disabled/)
    expect(washed).toContain('0,60 CC')
    expect(html).toContain('10 Einh. im Lager')
  })

  it('opens the first row with sellable stock, with "Alles" preselected', async () => {
    const { pinia } = setup()
    const html = await render(pinia)
    expect(row(html, 'robusta-raw')).toContain('aria-expanded="true"')
    expect(html.match(/data-testid="ticket-/g)?.length).toBeGreaterThan(0)
    expect(html).toContain('data-testid="ticket-robusta-raw"')
    expect(html).toMatch(/aria-pressed="true"[^>]*data-testid="ticket-preset-1"/)
    expect(html).toMatch(/value="10"[^>]*data-testid="ticket-amount"/)
  })

  it('opens no ticket when nothing is sellable', async () => {
    const { pinia } = setup([])
    const html = await render(pinia)
    expect(html).not.toContain('data-testid="ticket-')
    expect(html).not.toContain('aria-expanded="true"')
  })

  it('a falling price shows a down trend against the month before', async () => {
    const { pinia, game } = setup()
    const state = game.state as GameState
    game.replace({
      ...state,
      time: { ...state.time, day: 40 },
      market: {
        ...state.market,
        volumes: { coffee: { robusta: { units: 3000, day: 35, monthEnds: [] } } },
      },
    })
    expect(text(row(await render(pinia), 'robusta-raw'), 'bank-trend')).toMatch(/^▼ −\d+(,\d)? %$/)
  })

  it('keeps a locked variety with only washed units, hides locked ones without stock', async () => {
    const { pinia } = setup([
      { variety: 'arabicaPremium', units: 5, quality: 90, storedDay: 0, washed: true },
    ])
    const html = await render(pinia)
    expect(html).toContain('data-testid="market-arabicaPremium"')
    expect(html).toContain('data-testid="ticket-arabicaPremium-washed"')
    expect(html).not.toContain('data-testid="market-specialty"')
  })

  it('shows Arabica Premium when it is unlocked', async () => {
    const { pinia, game } = setup()
    game.replace({ ...(game.state as GameState), money: 200000 })
    expect(await render(pinia)).toContain('data-testid="market-arabicaPremium"')
  })

  it('the preview of "Alles" books exactly through Sell', () => {
    const { game } = setup()
    const before = game.state as GameState
    const after = dispatch(before, { type: 'Sell', variety: 'robusta', units: 10 })
    expect(after.money - before.money).toBe(400)
  })
})

describe('MarketPanel seed tab (#20)', () => {
  it('shows the seed stock and price per variety on the fixed scale', async () => {
    const { pinia } = setup()
    const html = await renderToString(createSSRApp(MarketSeed).use(pinia))
    const robusta = html.split('data-testid="seed-robusta"')[1]!.split('</article>')[0]!
    expect(text(robusta, 'seed-stock')).toBe('3')
    expect(text(robusta, 'seed-price')).toBe('2,00 CC')
    expect(robusta).toContain('Saatgut kostet je Einheit · 12 Monate')
    expect(robusta).toContain('data-testid="chart-reference"')
  })
})
