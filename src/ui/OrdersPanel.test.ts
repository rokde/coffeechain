import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useGameStore } from '../app/store'
import type { Order } from '../sim/market/orders'
import type { GameState } from '../sim/state'
import MarketPanel from './MarketPanel.vue'
import OrdersPanel from './OrdersPanel.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

const order: Order = {
  id: 1,
  variety: 'arabicaStandard',
  units: 30,
  minQuality: 80,
  price: 120,
  deadlineDay: 15,
}

function render(open: Order[], quality: number, units = 40) {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  game.replace({
    ...state,
    storage: { batches: [{ variety: 'arabicaStandard', units, quality }] },
    orders: { open, nextId: 2 },
  })
  return renderToString(createSSRApp(OrdersPanel).use(pinia))
}

const button = (html: string) => html.match(/<button[^>]*data-testid="order-deliver"[^>]*>/)![0]

describe('OrdersPanel (S56)', () => {
  it('AC-5: shows "Keine Aufträge" with no orders', async () => {
    const html = await render([], 90)
    expect(html).toContain('data-testid="orders-panel"')
    expect(html).toContain('Keine Aufträge')
    expect(html).not.toContain('order-deliver')
  })

  it('AC-5: shows the buyer, units, minimum quality, deadline and price', async () => {
    const html = await render([order], 90)
    const row = html.split('data-testid="order-1"')[1]!.replace(/ data-v-\w+/g, '')
    // names[1 % names.length] is the second name.
    expect(row).toContain('<span>Café Hafen</span><span>30 Arabica Standard</span>')
    expect(row).toContain('bis Tag</dt><dd>15')
    expect(row).toContain('mind. Qualität</dt><dd>80')
    // A neutral market: the bank pays 0.8 × 1 CC for Arabica Standard.
    expect(row.replace(/<[^>]*>/g, '')).toContain('je Einheit1,2 CC (Bank 0,8 CC)')
    expect(row).not.toContain('order-stock')
    expect(html).not.toContain('Keine Aufträge')
    expect(button(html)).not.toContain('disabled')
  })

  it('AC-5: disables "Liefern" and shows the qualifying stock when the stock does not qualify', async () => {
    const low = await render([order], 79)
    expect(button(low)).toContain('disabled')
    expect(button(low)).toContain('title="Passend (roh) im Lager: 0 / 30"')
    expect(low).toMatch(/data-testid="order-stock"[^>]*>Passend \(roh\) im Lager: 0 \/ 30</)
    const few = await render([{ ...order, units: 41 }], 90)
    expect(button(few)).toContain('disabled')
    expect(few).toMatch(/data-testid="order-stock"[^>]*>Passend \(roh\) im Lager: 40 \/ 41</)
    // Quality at the minimum counts, as in deliverableUnits.
    expect(button(await render([order], 80))).not.toContain('disabled')
  })

  it('S57 AC-5: shows the unit price with decimals and the raw stock hint', async () => {
    const html = await render([{ ...order, price: 59 }], 90)
    expect(html.replace(/<[^>]*>/g, '')).toContain('je Einheit0,59 CC (Bank 0,8 CC)')
    const twelve = await render([order], 90, 12)
    expect(twelve).toMatch(/data-testid="order-stock"[^>]*>Passend \(roh\) im Lager: 12 \/ 30</)
  })

  it('AC-5: the market panel shows the orders before the bank blocks', async () => {
    const pinia = createPinia()
    const html = await renderToString(createSSRApp(MarketPanel).use(pinia))
    expect(html.indexOf('orders-panel')).toBeGreaterThan(0)
    expect(html.indexOf('orders-panel')).toBeLessThan(html.indexOf('market-robusta'))
  })
})
