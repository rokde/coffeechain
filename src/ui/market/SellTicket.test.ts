import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useGameStore } from '../../app/store'
import { dispatch } from '../../sim/commands'
import { bankBuyPrice, bankPriceAfterSale, sellIncome } from '../../sim/market/market'
import type { GameState } from '../../sim/state'
import type { Batch } from '../../sim/storage/storage'
import PriceChart from './PriceChart.vue'
import { chartY } from './priceChart'
import SellTicket from './SellTicket.vue'
import {
  clampAmount,
  direction,
  formatChange,
  formatPrice,
  presetAmount,
  sellPreview,
  trend,
} from './sellTicket'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// Two Robusta batches, oldest first: 140 × Q 74, 220 × Q 82.
const BATCHES: Batch[] = [
  { variety: 'robusta', units: 140, quality: 74, storedDay: 0 },
  { variety: 'robusta', units: 220, quality: 82, storedDay: 5 },
]

function setup(patch: (s: GameState) => GameState = (s) => s) {
  const pinia = createPinia()
  const game = useGameStore(pinia)
  const state = game.state as GameState
  game.replace(
    patch({
      ...state,
      storage: { ...state.storage, batches: BATCHES },
      market: { volumes: {}, seeds: {} },
    }),
  )
  return { pinia, game }
}

const ticket = (
  pinia: ReturnType<typeof createPinia>,
  props: { variety?: 'robusta' | 'arabicaStandard'; washed?: boolean; max: number; amount: number },
) =>
  renderToString(
    createSSRApp({
      render: () => h(SellTicket, { variety: 'robusta', washed: false, ...props }),
    }).use(pinia),
  )
const text = (html: string, id: string) =>
  html
    .match(new RegExp(`data-testid="${id}"[^>]*>([\\s\\S]*?)</(dd|p|button|text)>`))![1]!
    .replace(/<[^>]*>/g, '')
    .trim()
const tag = (html: string, id: string) =>
  html.match(new RegExp(`<[a-z]+[^>]*data-testid="${id}"[^>]*>`))![0]

describe('amount (#20)', () => {
  it('clamps typed and dragged values to whole units from 0 to the stock', () => {
    expect(clampAmount(180, 360)).toBe(180)
    expect(clampAmount(999, 360)).toBe(360)
    expect(clampAmount(-5, 360)).toBe(0)
    expect(clampAmount(12.6, 360)).toBe(13)
    expect(clampAmount(Number(''), 360)).toBe(0)
    expect(clampAmount(Number('abc'), 360)).toBe(0)
  })

  it('the presets give 25 %, 50 % and all of the stock', () => {
    expect([0.25, 0.5, 1].map((s) => presetAmount(360, s))).toEqual([90, 180, 360])
    expect(presetAmount(3, 0.5)).toBe(2)
  })

  it('number field, slider and presets show the same amount', async () => {
    const { pinia } = setup()
    const html = await ticket(pinia, { max: 360, amount: 180 })
    expect(tag(html, 'ticket-amount')).toContain('value="180"')
    expect(tag(html, 'ticket-amount')).toContain('max="360"')
    expect(html).toContain('von 360 Einh.')
    const range = tag(html, 'ticket-range')
    expect(range).toContain('value="180"')
    expect(range).toContain('aria-valuetext="180 von 360 Einheiten"')
    expect(range).toContain('--p:50%')
    expect(tag(html, 'ticket-preset-0.5')).toContain('aria-pressed="true"')
    expect(tag(html, 'ticket-preset-0.25')).toContain('aria-pressed="false"')
    expect(tag(html, 'ticket-preset-1')).toContain('aria-pressed="false"')
  })

  it('an amount above the stock shows the stock', async () => {
    const { pinia } = setup()
    const html = await ticket(pinia, { max: 360, amount: 500 })
    expect(tag(html, 'ticket-amount')).toContain('value="360"')
    expect(tag(html, 'ticket-preset-1')).toContain('aria-pressed="true"')
  })

  it('0 units: the button asks for an amount and is disabled', async () => {
    const { pinia } = setup()
    const html = await ticket(pinia, { max: 360, amount: 0 })
    expect(tag(html, 'ticket-sell')).toContain('disabled')
    expect(text(html, 'ticket-sell')).toBe('Menge wählen')
    expect(text(html, 'ticket-batches')).toBe('Die Bank nimmt die ältesten Chargen zuerst.')
  })
})

describe('preview (#20)', () => {
  it('uses sellIncome and the price after the sale, as the booking does', async () => {
    const { pinia, game } = setup()
    const state = game.state as GameState
    const html = await ticket(pinia, { max: 360, amount: 180 })
    const income = sellIncome(state, 'robusta', 180)
    expect(text(html, 'preview-income')).toBe(`${income / 100} CC`)
    expect(text(html, 'preview-average')).toBe(formatPrice(bankBuyPrice(state, 'robusta', 180), 3))
    expect(text(html, 'preview-after')).toContain(
      formatPrice(bankPriceAfterSale(state, 'robusta', 180), 3),
    )
    expect(text(html, 'preview-after')).toMatch(/▼ −\d+(,\d)? %$/)
    expect(text(html, 'preview-rest')).toBe('180 Einh.')
    expect(text(html, 'ticket-sell')).toBe(`180 Einh. verkaufen · ${income / 100} CC`)
    expect(tag(html, 'ticket-preview')).toContain('aria-live="polite"')

    // The booking matches the preview: money, stock and the price after.
    const after = dispatch(state, { type: 'Sell', variety: 'robusta', units: 180 })
    expect(after.money - state.money).toBe(income)
    expect(bankBuyPrice(after, 'robusta')).toBeCloseTo(
      bankPriceAfterSale(state, 'robusta', 180),
      12,
    )
  })

  it('names the batches of the chosen amount, oldest first', async () => {
    const { pinia } = setup()
    expect(text(await ticket(pinia, { max: 360, amount: 180 }), 'ticket-batches')).toBe(
      'Die Bank nimmt die ältesten Chargen zuerst: 140 × Q 74, 40 × Q 82.',
    )
    expect(text(await ticket(pinia, { max: 360, amount: 100 }), 'ticket-batches')).toBe(
      'Die Bank nimmt die ältesten Chargen zuerst: 100 × Q 74.',
    )
  })

  it('merges neighbouring batches of the same quality', () => {
    const { game } = setup((s) => ({
      ...s,
      storage: {
        batches: [
          { variety: 'robusta', units: 10, quality: 70, storedDay: 0 },
          { variety: 'robusta', units: 10, quality: 70, storedDay: 3 },
          { variety: 'robusta', units: 10, quality: 80, storedDay: 4 },
        ],
      },
    }))
    expect(sellPreview(game.state as GameState, 'robusta', false, 25, 30).batches).toEqual([
      { quality: 70, units: 20 },
      { quality: 80, units: 5 },
    ])
  })

  it('a sale that pays 0 CC is disabled and says why', async () => {
    const { pinia } = setup()
    const html = await ticket(pinia, { max: 360, amount: 1 })
    expect(sellIncome(setup().game.state as GameState, 'robusta', 1)).toBe(0)
    expect(tag(html, 'ticket-sell')).toContain('disabled')
    expect(text(html, 'ticket-batches')).toBe('Menge zu klein: Die Bank zahlt dafür 0 CC.')
  })

  it('formats changes with arrow and sign, flat below half a tenth of a percent', () => {
    expect(formatChange(0.034)).toBe('▲ +3,4 %')
    expect(formatChange(-0.022)).toBe('▼ −2,2 %')
    expect(formatChange(0.0001)).toBe('▶ ±0 %')
    expect(direction(-0.01)).toBe('down')
    expect(trend([0.4, 0.38])).toBeCloseTo(-0.05, 12)
    expect(trend([0.4])).toBe(0)
    expect(formatPrice(0.38)).toBe('0,38 CC')
    expect(formatPrice(0.38, 3)).toBe('0,380 CC')
  })
})

describe('ticket actions (#20)', () => {
  const withProcessing = (s: GameState): GameState => ({
    ...s,
    buildings: { 0: { kind: 'processing' } },
  })

  it('raw coffee offers "Aufbereiten" as a second action with the washed price', async () => {
    const { pinia } = setup(withProcessing)
    const html = await ticket(pinia, { max: 360, amount: 360 })
    expect(tag(html, 'ticket-process')).not.toContain('disabled')
    expect(text(html, 'ticket-process')).toBe('Aufbereiten (50 Einh., 15 CC)')
    expect(html).toContain('Stattdessen aufbereiten?')
    expect(html).toContain('Gewaschen zahlt die Bank 0,60 CC je Einh.')
  })

  it.each([
    ['without a building', (s: GameState) => s, 'Baue zuerst eine Aufbereitung.'],
    [
      'with too little money',
      (s: GameState) => ({ ...withProcessing(s), money: 100 }),
      'Zu wenig Geld.',
    ],
    [
      'while a processing runs',
      (s: GameState) => ({
        ...withProcessing(s),
        storage: {
          batches: [
            ...BATCHES,
            {
              variety: 'arabicaStandard' as const,
              units: 5,
              quality: 90,
              storedDay: 0,
              washed: true as const,
              readyDay: 30,
            },
          ],
        },
      }),
      'Es läuft schon eine Aufbereitung.',
    ],
  ] as const)('"Aufbereiten" %s is disabled and says why', async (_, patch, why) => {
    const { pinia } = setup(patch)
    const html = await ticket(pinia, { max: 360, amount: 360 })
    expect(tag(html, 'ticket-process')).toContain('disabled')
    expect(html).toContain(`Gerade nicht möglich: ${why}`)
  })

  it('washed coffee has no "Aufbereiten" and names a running processing', async () => {
    const { pinia } = setup((s) => ({
      ...s,
      storage: {
        batches: [
          { variety: 'robusta', units: 30, quality: 80, storedDay: 0, washed: true },
          { variety: 'robusta', units: 50, quality: 80, storedDay: 0, washed: true, readyDay: 31 },
        ],
      },
    }))
    const html = await ticket(pinia, { washed: true, max: 30, amount: 30 })
    expect(html).not.toContain('ticket-process')
    expect(text(html, 'ticket-running')).toBe(
      '50 Einh. in der Aufbereitung: verkaufbar ab 2. Februar, Jahr 1 (in 31 Tagen).',
    )
  })

  it('a good with nothing sellable shows why and no sell button', async () => {
    const { pinia } = setup((s) => ({
      ...s,
      storage: {
        batches: [
          { variety: 'robusta', units: 50, quality: 80, storedDay: 0, washed: true, readyDay: 31 },
        ],
      },
    }))
    const html = await ticket(pinia, { washed: true, max: 0, amount: 0 })
    expect(html).toContain('Nichts zu verkaufen')
    expect(html).toContain('Die Ware ist noch in der Aufbereitung.')
    expect(html).not.toContain('ticket-sell')
    expect(html).toContain('data-testid="price-chart"')
  })
})

describe('price chart (#20)', () => {
  const chart = (props: {
    history: number[]
    reference: number
    after: number | null
    day?: number
  }) => renderToString(createSSRApp({ render: () => h(PriceChart, { day: 0, ...props }) }))
  const ys = (html: string) =>
    html
      .match(/points="([^"]*)"/)![1]!
      .split(' ')
      .map((p) => Number(p.split(',')[1]))
  // The plot of the default chart: 12 px from the top, 182 px tall (216 − 12 − 22).
  const T = 12
  const PH = 182

  it('has a fixed scale from 50 to 150 % of the reference with a dashed reference line', async () => {
    const html = await chart({ history: Array(12).fill(0.4), reference: 0.4, after: null })
    expect(html).toMatch(/y1="12"[^>]*class="grid"/)
    expect(html).toMatch(/y1="103"[^>]*class="ref"[^>]*data-testid="chart-reference"/)
    expect(html).toMatch(/y1="194"[^>]*class="grid"/)
    expect(html).toContain('>0,60</text>')
    expect(html).toContain('>0,40</text>')
    expect(html).toContain('>0,20</text>')
    expect(html).toContain('Referenz')
    expect(ys(html)).toEqual(Array(12).fill(103))
  })

  it('a small move stays small: 0.40 to 0.43 CC moves 7.5 % of the scale', async () => {
    const history = [...Array(11).fill(0.4), 0.43]
    const y = ys(await chart({ history, reference: 0.4, after: null }))
    expect(y[10]! - y[11]!).toBeCloseTo(PH * 0.075, 0)
    expect(chartY(0.43, 0.4, T, PH)).toBeCloseTo(103 - 13.65, 6)
  })

  it('holds prices outside the scale at its edges', () => {
    expect(chartY(0.1, 0.4, T, PH)).toBe(T + PH)
    expect(chartY(1, 0.4, T, PH)).toBe(T)
  })

  it('highlights today with its value and shows the price after the trade with its change', async () => {
    const html = await chart({
      history: Array(12).fill(0.38),
      reference: 0.4,
      after: 0.38 * 0.978,
    })
    expect(text(html, 'chart-today-label')).toBe('0,38 CC')
    expect(html).toContain('data-testid="chart-after"')
    expect(text(html, 'chart-after-label')).toBe('▼ −2,2 %')
    expect(html).toMatch(
      /role="img" aria-label="Preisverlauf der letzten 12 Monate\. Heute 0,38 CC, das sind 95 % der Referenz von 0,40 CC\. Nach dem Handel 0,37 CC\."/,
    )
  })

  it('without a trade it shows no after point', async () => {
    const html = await chart({ history: Array(12).fill(0.4), reference: 0.4, after: null })
    expect(html).not.toContain('chart-after')
    expect(html).toContain('Heute 0,40 CC, das sind 100 % der Referenz von 0,40 CC.')
  })

  it('names each past month in a tooltip and the axis by short month names', async () => {
    // Day 431 lies in March of year 2: the history runs from April to March.
    const html = await chart({
      history: Array(12).fill(0.4),
      reference: 0.4,
      after: null,
      day: 431,
    })
    const titles = [...html.matchAll(/<title[^>]*>([^<]*)<\/title>/g)].map((m) => m[1])
    expect(titles).toHaveLength(11)
    expect(titles[0]).toBe('Apr: 0,40 CC (100 % der Referenz)')
    expect(titles[10]).toBe('Feb: 0,40 CC (100 % der Referenz)')
    expect(html).toMatch(/text-anchor="end" class="axis"[^>]*>Mär<\/text>/)
  })
})
