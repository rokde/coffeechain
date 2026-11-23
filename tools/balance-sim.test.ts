import { describe, expect, it } from 'vitest'
import { balance } from '../src/sim/balance'
import type { Order } from '../src/sim/market/orders'
import { createState, type GameState } from '../src/sim/state'
import type { Batch } from '../src/sim/storage/storage'
import {
  BOT_PARAMS,
  daysTo,
  holdSales,
  nextDelivery,
  parseStrategies,
  pinnedShare,
  renderReport,
  reserveForOrders,
  runBot,
  sellAllBut,
  STRATEGIES,
  type BotResult,
  type Strategy,
} from './balance-sim'

describe('runBot', () => {
  let first: BotResult | undefined
  const run = () => (first ??= runBot(1, 200))

  // 200 game days; parallel suite load
  it('gives one capital per day and grows the farm without debt', () => {
    const a = run()
    expect(a.curve).toHaveLength(200)
    expect(a.minMoney).toBeGreaterThanOrEqual(0)
    expect(a.parcels).toBeGreaterThan(1)
    expect(a.curve.at(-1)).toBeGreaterThan(balance().economy.startCapital)
  }, 20000)

  // 200 game days; parallel suite load
  it('repeats per seed', () => {
    expect(runBot(1, 200)).toEqual(run())
  }, 20000)
})

// 1500 game days per strategy: the market of seed 1 drops low enough for hold, and orders come in.
describe('runBot per strategy (#50)', () => {
  const DAYS = 1500
  const cache = new Map<Strategy, BotResult>()
  const run = (s: Strategy) => cache.get(s) ?? cache.set(s, runBot(1, DAYS, s)).get(s)!
  const price = (c: { units: number; income: number }) => c.income / c.units

  it.each(STRATEGIES)(
    '%s repeats per seed',
    (s) => {
      expect(runBot(1, DAYS, s)).toEqual(run(s))
    },
    30000,
  )

  it('bank-now sells everything to the bank right away', () => {
    const r = run('bank-now')
    expect(r.strategy).toBe('bank-now')
    expect(r.bank.units).toBeGreaterThan(0)
    expect(r.orders).toEqual({ units: 0, income: 0 })
    expect(r.ordersDelivered).toBe(0)
    expect(r.storageCost).toBe(0)
    expect(r.qualityLoss).toBe(0)
    expect(r.minMoney).toBeGreaterThanOrEqual(0)
  }, 30000)

  it('hold keeps stock, pays storage and sells only to the bank', () => {
    const r = run('hold')
    expect(r.bank.units).toBeGreaterThan(0)
    expect(r.orders.units).toBe(0)
    expect(r.storageCost).toBeGreaterThan(0)
    expect(r.qualityLoss).toBeGreaterThan(0)
    expect(r.minMoney).toBeGreaterThanOrEqual(0)
  }, 30000)

  it('orders earns part of its income from orders at a better price than the bank', () => {
    const r = run('orders')
    expect(r.ordersDelivered).toBeGreaterThan(0)
    expect(r.ordersDelivered).toBeLessThanOrEqual(r.ordersSeen)
    expect(r.orders.units).toBeGreaterThan(0)
    expect(price(r.orders)).toBeGreaterThan(price(r.bank))
    expect(r.minMoney).toBeGreaterThanOrEqual(0)
  }, 30000)

  it('starts all strategies from the same game', () => {
    // Same seed, same first harvest: the curves only part once the strategies sell differently.
    const [a, b, c] = STRATEGIES.map((s) => run(s).curve[0])
    expect(a).toBe(b)
    expect(a).toBe(c)
  }, 30000)
})

const batch = (units: number, quality: number, storedDay: number, variety = 'robusta'): Batch =>
  ({ variety, units, quality, storedDay }) as Batch

// A fresh game on the given day with the given stock, orders and traded robusta volume.
function stocked(
  batches: Batch[],
  { day = 0, volume = 0, orders = [] as Order[] } = {},
): GameState {
  const state = createState(1)
  return {
    ...state,
    time: { ...state.time, day },
    storage: { batches },
    orders: { open: orders, nextId: orders.length },
    market: {
      ...state.market,
      volumes: volume ? { coffee: { robusta: { units: volume, day, monthEnds: [] } } } : {},
    },
  }
}

const order = (id: number, units: number, minQuality: number, price: number): Order => ({
  id,
  variety: 'robusta',
  units,
  minQuality,
  price,
  deadlineDay: 100 + id,
})

describe('sellAllBut', () => {
  it('sells each variety in full with one sale, in storage order', () => {
    const state = stocked([
      batch(10, 80, 0, 'arabicaStandard'),
      batch(20, 70, 0),
      batch(5, 90, 1, 'arabicaStandard'),
    ])
    expect(sellAllBut(state)).toEqual([
      { type: 'Sell', variety: 'arabicaStandard', units: 15 },
      { type: 'Sell', variety: 'robusta', units: 20 },
    ])
  })

  it('sells per quality and storage day around the kept units', () => {
    const state = stocked([batch(10, 80, 0), batch(20, 70, 0), batch(5, 80, 0)])
    expect(sellAllBut(state, [10, 5, 0])).toEqual([
      { type: 'Sell', variety: 'robusta', units: 5, quality: 80, storedDay: 0 },
      { type: 'Sell', variety: 'robusta', units: 15, quality: 70, storedDay: 0 },
    ])
  })

  it('sells nothing from an empty storage', () => {
    expect(sellAllBut(stocked([]))).toEqual([])
  })
})

describe('nextDelivery', () => {
  it('picks the best price among the orders the stock can meet', () => {
    const state = stocked([batch(40, 85, 0)], {
      orders: [order(0, 30, 80, 60), order(1, 30, 80, 70), order(2, 20, 90, 99)],
    })
    expect(nextDelivery(state)?.id).toBe(1)
  })

  it('finds nothing when no order fits the stock', () => {
    const state = stocked([batch(40, 75, 0)], { orders: [order(0, 30, 80, 60)] })
    expect(nextDelivery(state)).toBeUndefined()
  })
})

describe('reserveForOrders', () => {
  const params = { reserveShare: 0.5 }

  it('keeps the lowest qualifying quality for the earliest deadline', () => {
    const state = stocked([batch(40, 75, 0), batch(20, 85, 0), batch(20, 90, 0)], {
      orders: [order(0, 30, 80, 60)],
    })
    expect(reserveForOrders(state, params)).toEqual([0, 20, 10])
  })

  it('skips an order that does not fit into the reserve', () => {
    // Capacity 100 × 0.5 = 50 units of reserve: 60 do not fit, the 20 of the later order do.
    const state = stocked([batch(80, 85, 0)], {
      orders: [order(0, 60, 80, 60), order(1, 20, 80, 60)],
    })
    expect(reserveForOrders(state, params)).toEqual([20])
  })
})

describe('holdSales', () => {
  const p = BOT_PARAMS.hold

  it('sells everything while the market is untouched', () => {
    expect(holdSales(stocked([batch(50, 80, 0)]), p)).toEqual([
      { type: 'Sell', variety: 'robusta', units: 50 },
    ])
  })

  it('holds young stock below the limit while the price is low and recovers', () => {
    // 3000 units of volume: factor about 0.78; one half-life later about 0.85.
    expect(holdSales(stocked([batch(50, 80, 0)], { volume: 3000 }), p)).toEqual([])
  })

  it('sells batches of maxAgeMonths and more', () => {
    const state = stocked([batch(10, 80, 100), batch(30, 80, 250)], { day: 300, volume: 3000 })
    expect(holdSales(state, p)).toEqual([{ type: 'Sell', variety: 'robusta', units: 10 }])
  })

  it('sells the oldest units above maxStockShare of the capacity', () => {
    const state = stocked([batch(60, 80, 0), batch(35, 80, 1)], { day: 2, volume: 3000 })
    expect(holdSales(state, p)).toEqual([{ type: 'Sell', variety: 'robusta', units: 15 }])
  })

  it('sells everything when waiting a month gains less than the storage cost', () => {
    // At 20000 units the factor sits near its floor and barely moves in a month.
    expect(holdSales(stocked([batch(50, 80, 0)], { volume: 20000 }), p)).toEqual([
      { type: 'Sell', variety: 'robusta', units: 50 },
    ])
  })
})

describe('parseStrategies', () => {
  it('runs all strategies without an option', () =>
    expect(parseStrategies([])).toEqual([...STRATEGIES]))
  it('takes one or a list', () => {
    expect(parseStrategies(['--strategy', 'hold'])).toEqual(['hold'])
    expect(parseStrategies(['--strategy=orders,bank-now'])).toEqual(['bank-now', 'orders'])
  })
  it('rejects an unknown strategy', () =>
    expect(() => parseStrategies(['--strategy', 'dump'])).toThrow('Unknown strategy: dump'))
})

describe('daysTo', () => {
  it('finds a hit on day 1', () => expect(daysTo([2000, 1500], 2000)).toBe(1))
  it('finds a later hit', () => expect(daysTo([500, 1999, 2500, 1800], 2000)).toBe(3))
  it('gives null without a hit', () => expect(daysTo([500, 1999], 2000)).toBeNull())
})

// Capital rises by perDay each day from 500 CC.
const result = (
  seed: number,
  perDay: number,
  parcelSpend = 100,
  totalSpend = 300,
  strategy: Strategy = 'bank-now',
): BotResult => ({
  seed,
  strategy,
  bank: { units: 1000, income: 40000 },
  orders: { units: 0, income: 0 },
  ordersSeen: 2,
  ordersDelivered: 0,
  storageCost: 0,
  qualityLoss: 0,
  curve: Array.from({ length: 30 }, (_, i) => 500 + perDay * (i + 1)),
  supply: [1, 1, 0.9, 0.71, 0.75],
  demand: [1, 1.1, 1.29],
  parcels: seed + 1,
  minMoney: 0,
  parcelSpend,
  totalSpend,
})
const cfgWith = (phase1TargetDays: number) => {
  const cfg = balance()
  return { ...cfg, balanceSim: { ...cfg.balanceSim, phase1TargetDays } }
}
const section = (md: string) => md.split('## Empfehlung zu PRD §12 Punkt 1')[1]!

describe('pinnedShare (#18)', () => {
  it('counts the days near the end of the range from the first trade', () => {
    // 0.71 is within 5 % of the way from 0.7 to 1 (0.015); 0.9 and 0.75 are not.
    expect(pinnedShare([1, 1, 0.9, 0.71, 0.75], 0.7)).toBeCloseTo(1 / 3)
    expect(pinnedShare([1, 1.1, 1.29], 1.3)).toBeCloseTo(1 / 2)
    expect(pinnedShare([1, 1], 0.7)).toBe(0)
  })
})

describe('renderReport', () => {
  // Seed 1 gets to 2,000 CC on day 15, seed 2 on day 30, seed 3 never. Nobody gets to 10,000 CC.
  const results = [result(1, 100), result(2, 50), result(3, 10)]
  const md = renderReport(results, cfgWith(28))

  it('lists the parameters, one row per seed, the medians and the curve', () => {
    expect(md).toContain('| Spieltage | 30 |')
    expect(md).toContain('| Seeds | 3 (1, 2, 3) |')
    expect(md).toContain('| Ziel Phase 1 | 28 Spieltage |')
    expect(md).toContain('| 1 | 15 | nicht erreicht | 3.500 | 2 |')
    expect(md).toContain('| 2 | 30 | nicht erreicht | 2.000 | 3 |')
    expect(md).toContain('| 3 | nicht erreicht | nicht erreicht | 800 | 4 |')
    expect(md).toContain('| Median | 30 | nicht erreicht | 2.000 | 3 |')
    expect(md).toContain('| 10 | 1.000 | 600 | 1.500 |')
    expect(md).toContain('| 20 | 1.500 | 700 | 2.500 |')
    expect(md).toContain('| 30 | 2.000 | 800 | 3.500 |')
    expect(md).not.toContain('| 40 |')
    expect(md).toContain('## Empfehlung zu PRD §12 Punkt 1')
    expect(md).toContain('## Marktreaktion Robusta (#18)')
    expect(md).toContain('| 1 | 33 % | 0,900 | 50 % | 1,100 |')
  })

  it('needs no change when the median is at or below the target', () => {
    const text = section(renderReport(results, cfgWith(30)))
    expect(text).toContain('keine Änderung nötig')
    expect(text).not.toContain('günstigere Parzellen')
  })

  it('recommends cheaper parcels when parcels are more than half of the spending', () => {
    const text = section(
      renderReport(
        results.map((r) => ({ ...r, parcelSpend: 200 })),
        cfgWith(10),
      ),
    )
    expect(text).toContain('Faktor 3,0')
    expect(text).toContain('**günstigere Parzellen**')
    expect(text).toContain('**niedrigere Phasengrenzen**')
    expect(text).not.toContain('höhere Erträge pro Parzelle')
  })

  it('recommends higher yields when parcels are at most half of the spending', () => {
    const text = section(renderReport(results, cfgWith(10)))
    expect(text).toContain('Faktor 3,0')
    expect(text).toContain('**höhere Erträge pro Parzelle**')
    expect(text).toContain('**niedrigere Phasengrenzen**')
    expect(text).not.toContain('günstigere Parzellen')
  })
})

describe('renderReport, sell strategies (#50)', () => {
  const runs = [
    ...[1, 2, 3].map((seed) => result(seed, 100)),
    ...[1, 2, 3].map((seed) => ({
      ...result(seed, 90, 100, 300, 'hold'),
      storageCost: 1200,
      qualityLoss: 500,
    })),
    ...[1, 2, 3].map((seed) => ({
      ...result(seed, 110, 100, 300, 'orders'),
      bank: { units: 900, income: 36000 },
      orders: { units: 100, income: 9000 },
      ordersDelivered: 1,
      storageCost: 300,
      qualityLoss: 100,
    })),
  ]
  const md = renderReport(runs, cfgWith(28))
  const strategies = md.split('## Verkaufsstrategien (#50)')[1]!.split('## Empfehlung')[0]!

  it('keeps the sections above on bank-now', () => {
    expect(md).toContain('| Seeds | 3 (1, 2, 3) |')
    expect(md).toContain('| 1 | 15 | nicht erreicht | 3.500 | 2 |')
  })

  it('names each strategy with its bot parameters', () => {
    expect(strategies).toContain('- **`bank-now`**')
    expect(strategies).toContain('mindestens 90 %')
    expect(strategies).toContain('ab 6 Monaten')
    expect(strategies).toContain('über 80 % der Lagerkapazität')
    expect(strategies).toContain('höchstens 50 % der Lagerkapazität')
  })

  it('shows the income per channel and the price per unit', () => {
    expect(strategies).toContain('| `bank-now` | 400 | 0 | 0,0 % | 0,400 | – | 0,400 |')
    expect(strategies).toContain('| `hold` | 400 | 0 | 0,0 % | 0,400 | – | 0,400 |')
    expect(strategies).toContain('| `orders` | 360 | 90 | 20,0 % | 0,400 | 0,900 | 0,450 |')
  })

  it('shows storage cost, quality loss, orders and the capital against bank-now', () => {
    // Capital per day: bank-now +100, hold +90, orders +110 from 500 CC.
    expect(strategies).toContain('| `bank-now` | 0 | 0 | 0,000 | 0 / 6 | 15 | 3.500 | – |')
    expect(strategies).toContain(
      '| `hold` | 12 | 500 | 0,500 | 0 / 6 | 17 | 3.200 | −300 (−8,6 %) |',
    )
    expect(strategies).toContain(
      '| `orders` | 3 | 100 | 0,100 | 3 / 6 | 14 | 3.800 | +300 (+8,6 %) |',
    )
  })
})
