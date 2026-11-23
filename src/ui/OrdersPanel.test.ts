import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useGameStore } from '../app/store'
import { sellIncome } from '../sim/market/market'
import type { Order } from '../sim/market/orders'
import type { GameState } from '../sim/state'
import type { Batch } from '../sim/storage/storage'
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

const arabica = (units: number, quality: number, extra: Partial<Batch> = {}): Batch => ({
  variety: 'arabicaStandard',
  units,
  quality,
  storedDay: 0,
  ...extra,
})

async function render(open: Order[], batches: Batch[]) {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  game.replace({ ...state, storage: { batches }, orders: { open, nextId: 9 } })
  const html = await renderToString(createSSRApp(OrdersPanel).use(pinia))
  return { html: html.replace(/ data-v-\w+(="")?/g, ''), state: game.state as GameState }
}

const card = (html: string, id: number) =>
  html.split(`data-testid="order-${id}"`)[1]!.split('</article>')[0]!
const part = (html: string, id: string) =>
  html
    .split(`data-testid="${id}"`)[1]!
    .replace(/^[^>]*>/, '')
    .split(/<\/(?:div|p|button)>/)[0]!
// Block-like elements become a space, inline spans stay glued.
const text = (html: string) =>
  html
    .replace(/<!--[^>]*-->/g, '')
    .replace(
      /<\/?(?:b|small|div|p|h4)\b[^>]*>|<span (?:class="(?:lab|match)"|data-testid)[^>]*>/g,
      ' ',
    )
    .replace(/<[^>]*>/g, '')
const squash = (html: string) => text(html).replace(/\s+/g, ' ').trim()
const button = (html: string) => html.match(/<button[^>]*data-testid="order-deliver"[^>]*>/)![0]

describe('OrdersPanel (#22)', () => {
  it('shows "Keine Aufträge" and no filter with no orders', async () => {
    const { html } = await render([], [arabica(40, 90)])
    expect(html).toContain('data-testid="orders-panel"')
    expect(html).toContain('Keine Aufträge')
    expect(html).not.toContain('order-deliver')
    expect(html).not.toContain('orders-filter-all')
  })

  it('shows buyer, deadline with days left, goods with state and minimum quality', async () => {
    const { html } = await render([order], [arabica(40, 90)])
    const c = card(html, 1)
    // names[1 % names.length] is the second name.
    expect(c).toContain('>Café Hafen</h4>')
    expect(c).toContain('aria-hidden="true">CH</span>')
    // Day 15 is in the current year: no year. 15 days left, so the deadline stands out.
    expect(c).toMatch(/class="soon due"/)
    expect(squash(part(c, 'order-deadline'))).toBe('bis 16. Januar noch 15 Tage')
    expect(squash(part(c, 'order-ask'))).toBe('30 Einh. Arabica Standard roh mind. Q 80')
  })

  it('compares the price and the income with the bank', async () => {
    const { html, state } = await render([order], [arabica(40, 90)])
    const c = card(html, 1)
    // A neutral market: the bank pays 0.8 × 1 CC for Arabica Standard, the order 1.20 CC.
    expect(squash(part(c, 'order-price'))).toBe('Preis je Einheit 1,2 CC Bank heute 0,8 CC · +50 %')
    const bank = sellIncome(state, 'arabicaStandard', 30) / 100
    expect(bank).toBeLessThan(24)
    expect(squash(part(c, 'order-income'))).toBe(`Erlös 36 CC Bank für 30 Einh.: ${bank} CC`)
    const cheap = await render([{ ...order, price: 59 }], [arabica(40, 90)])
    expect(squash(part(card(cheap.html, 1), 'order-price'))).toBe(
      'Preis je Einheit 0,59 CC Bank heute 0,8 CC · −26,2 %',
    )
    expect(card(cheap.html, 1)).toContain('class="down nowrap"')
  })

  it('shows the matching stock with a bar and the lots in delivery order', async () => {
    const batches = [arabica(10, 92), arabica(15, 85), arabica(5, 85), arabica(9, 70)]
    const { html } = await render([order], batches)
    const c = card(html, 1)
    expect(squash(part(c, 'order-stock'))).toBe('Passend im Lager 30 / 30 20 × Q 85, 10 × Q 92')
    expect(c).toContain('aria-label="30 von 30 Einheiten passen"')
    expect(c).toContain('style="width:100%;"')
    expect(squash(part(c, 'order-lots'))).toBe('20 × Q 85, 10 × Q 92')
  })

  it('a deliverable order says so and names its income on the button', async () => {
    const { html } = await render([order], [arabica(40, 80)])
    const c = card(html, 1)
    expect(c.startsWith(' class="ready order"') || html.includes('class="ready order"')).toBe(true)
    expect(squash(part(c, 'order-why'))).toBe(
      '✓ Lieferbar. Geliefert wird die niedrigste passende Qualität zuerst.',
    )
    expect(button(c)).not.toContain('disabled')
    expect(button(c)).toContain('aria-describedby="order-1-why"')
    expect(squash(part(c, 'order-deliver'))).toBe('Liefern · 36 CC')
  })

  it('a blocked "Liefern" names what is missing as visible text', async () => {
    const few = card((await render([order], [arabica(12, 90), arabica(50, 79)])).html, 1)
    expect(button(few)).toContain('disabled')
    expect(squash(part(few, 'order-deliver'))).toBe('Liefern')
    expect(squash(part(few, 'order-why'))).toBe(
      'Es fehlen 18 Einh. roh ab Q 80. 50 Einh. mit Q 79 liegen knapp darunter.',
    )
    expect(squash(part(few, 'order-stock'))).toBe('Passend im Lager 12 / 30 12 × Q 90')
    expect(few).toContain('style="width:40%;"')

    // Washed coffee does not count: orders take raw coffee only.
    const none = card(
      (await render([order], [arabica(60, 95, { washed: true, readyDay: 0 }), arabica(5, 72)]))
        .html,
      1,
    )
    expect(squash(part(none, 'order-why'))).toBe(
      'Kein Arabica Standard (roh) ab Q 80 im Lager. Beste Charge: Q 72.',
    )
    expect(squash(part(none, 'order-lots'))).toBe('keine passende Charge')
    const empty = card((await render([order], [])).html, 1)
    expect(squash(part(empty, 'order-why'))).toBe('Kein Arabica Standard (roh) ab Q 80 im Lager.')
  })

  it('shows the year of a deadline in another year and no highlight beyond 30 days', async () => {
    const far = card((await render([{ ...order, deadlineDay: 431 }], [])).html, 1)
    expect(squash(part(far, 'order-deadline'))).toBe('bis 12. März, Jahr 2 noch 431 Tage')
    expect(far).toMatch(/class="due"/)
    const edge = card((await render([{ ...order, deadlineDay: 30 }], [])).html, 1)
    expect(edge).toMatch(/class="soon due"/)
    const last = card((await render([{ ...order, deadlineDay: 0 }], [])).html, 1)
    expect(squash(part(last, 'order-deadline'))).toBe('bis 1. Januar heute letzter Tag')
    const one = card((await render([{ ...order, deadlineDay: 1 }], [])).html, 1)
    expect(squash(part(one, 'order-deadline'))).toBe('bis 2. Januar noch 1 Tag')
  })

  it('lists deliverable orders first, then by deadline, and counts both filters', async () => {
    const open: Order[] = [
      { ...order, id: 1, deadlineDay: 40 },
      { ...order, id: 2, deadlineDay: 20, minQuality: 95 },
      { ...order, id: 3, deadlineDay: 90 },
      { ...order, id: 4, deadlineDay: 10, minQuality: 95 },
    ]
    const { html } = await render(open, [arabica(40, 90)])
    const ids = [...html.matchAll(/data-testid="order-(\d+)"/g)].map((m) => Number(m[1]))
    expect(ids).toEqual([1, 3, 4, 2])
    expect(squash(part(html, 'orders-filter-all'))).toBe('Alle 4')
    expect(squash(part(html, 'orders-filter-ready'))).toBe('Lieferbar 2')
    expect(html).toMatch(/data-testid="orders-filter-all" aria-pressed="true"/)
    expect(text(html)).toContain('Lieferbare zuerst, dann nach Frist')
  })

  it('leaves out the profile line and the placeholders for #23', async () => {
    const { html } = await render([order], [arabica(40, 90)])
    expect(html).not.toContain('#23')
    expect(html).not.toContain('Ruf')
    expect(html).not.toContain('Verträge')
  })

  it('the market panel shows the orders before the bank blocks', async () => {
    const pinia = createPinia()
    const html = await renderToString(createSSRApp(MarketPanel).use(pinia))
    expect(html.indexOf('orders-panel')).toBeGreaterThan(0)
    expect(html.indexOf('orders-panel')).toBeLessThan(html.indexOf('market-robusta'))
  })
})
