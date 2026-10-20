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

function render(open: Order[], quality: number) {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  game.replace({
    ...state,
    storage: { batches: [{ variety: 'arabicaStandard', units: 40, quality }] },
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
    expect(row).toContain('je Einheit</dt><dd>1,2 CC')
    expect(html).not.toContain('Keine Aufträge')
    expect(button(html)).not.toContain('disabled')
  })

  it('AC-5: disables "Liefern" when the stock does not qualify', async () => {
    expect(button(await render([order], 79))).toContain('disabled')
    expect(button(await render([{ ...order, units: 41 }], 90))).toContain('disabled')
  })

  it('AC-5: the market panel shows the orders before the bank blocks', async () => {
    const pinia = createPinia()
    const html = await renderToString(createSSRApp(MarketPanel).use(pinia))
    expect(html.indexOf('orders-panel')).toBeGreaterThan(0)
    expect(html.indexOf('orders-panel')).toBeLessThan(html.indexOf('market-robusta'))
  })
})
