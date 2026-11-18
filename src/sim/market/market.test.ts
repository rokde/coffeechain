import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import type { Variety } from '../farm/yield'
import { mulberry32 } from '../rng'
import { createState, type GameState } from '../state'
import {
  bankBuyPrice,
  bankSellPrice,
  marketPrice,
  priceAt,
  priceHistory,
  sellIncome,
  volumeOn,
  type Good,
  type Volumes,
} from './market'

const cfg = balance()
const m = cfg.market
const varieties = Object.keys(cfg.varieties) as Variety[]

// Stores two old Robusta batches and one Arabica batch, oldest first.
function testState(): GameState {
  const state = createState(1)
  return {
    ...state,
    storage: {
      batches: [
        { variety: 'robusta', units: 6, quality: 90, storedDay: 0 },
        { variety: 'arabicaStandard', units: 5, quality: 100, storedDay: 0 },
        { variety: 'robusta', units: 500, quality: 100, storedDay: 0 },
      ],
    },
  }
}

const atDay = (state: GameState, day: number): GameState => ({
  ...state,
  time: { ...state.time, day },
})

const coffee: Good = { kind: 'coffee', variety: 'robusta' }
const seed: Good = { kind: 'seed', variety: 'robusta' }
const half = m.volumeHalfLifeDays

// Supply factor (coffee) or demand factor (seed) at a volume.
const factor = (good: Good, volume: number) =>
  good.kind === 'seed'
    ? 1 + (m.demandFactorRange[1]! - 1) * (1 - 2 ** (-volume / m.demandUnitsForHalfFactor))
    : 1 - (1 - m.supplyFactorRange[0]!) * (1 - 2 ** (-volume / m.supplyUnitsForHalfFactor))

// Mean factor over the volumes from `from` to `from + units`, by the Simpson rule.
function meanFactor(good: Good, from: number, units: number) {
  const n = 1000
  const h = units / n
  let sum = factor(good, from) + factor(good, from + units)
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * factor(good, from + i * h)
  return (sum * h) / 3 / units
}

// Sells (coffee) or buys (seed) Robusta on each listed day, with enough stock and money.
function trade(state: GameState, good: Good, sales: [day: number, units: number][]) {
  for (const [day, units] of sales) {
    const batch = { variety: 'robusta' as const, units, quality: 100, storedDay: 0 }
    const at = { ...atDay(state, day), money: 1e12, storage: { batches: [batch] } }
    state =
      good.kind === 'seed'
        ? dispatch(at, { type: 'Buy', variety: 'robusta', units })
        : dispatch(at, { type: 'Sell', variety: 'robusta', units })
  }
  return state
}

describe('market', () => {
  it('AC-1: the bank buys Robusta for 0.4 CC at a neutral market', () => {
    const state = testState()
    expect(bankBuyPrice(state, 'robusta')).toBeCloseTo(0.4)
    const next = dispatch(state, { type: 'Sell', variety: 'robusta', units: 10 })
    // The 10 units sell at the mean price over the volumes 0 to 10, 0.39986 CC.
    // S57: the income of 3.9986 CC is 400 hundredths, so whole 4 CC.
    expect(sellIncome(state, 'robusta', 10)).toBe(400)
    expect(next.money).toBe(state.money + 400)
    expect(next.storage.batches).toEqual([
      { variety: 'arabicaStandard', units: 5, quality: 100, storedDay: 0 },
      { variety: 'robusta', units: 496, quality: 100, storedDay: 0 },
    ])
  })

  it('AC-2: Buy charges the config seed price and adds to the seed stock', () => {
    const state = testState()
    const seedCost = cfg.varieties.robusta.seedCost
    expect(bankSellPrice(state, 'robusta')).toBeCloseTo(seedCost)
    const next = dispatch(state, { type: 'Buy', variety: 'robusta', units: 5 })
    // The 5 units cost the mean price over the volumes 0 to 5.
    // S57: the cost rounds up to whole CC.
    const cost = Math.ceil(5 * seedCost * meanFactor(seed, 0, 5) - 1e-9) * 100
    expect(next.money).toBe(state.money - cost)
    expect(next.market.seeds.robusta).toBe(5)
  })

  it.each([
    ['Sell', 2],
    ['Sell', 100],
    ['Sell', 240],
    ['Buy', 2],
    ['Buy', 100],
    ['Buy', 160],
  ] as const)('AC-2 (S21b): one %s of %i units equals two trades of half the units', (type, n) => {
    // S57: each trade rounds to whole CC against the player, so two trades never give more.
    const state: GameState = {
      ...testState(),
      money: 1e9,
      // Earlier trades today, so the trade does not start at a neutral market.
      market: {
        seeds: {},
        volumes: {
          coffee: { robusta: { units: 30, day: 0, monthEnds: [] } },
          seed: { robusta: { units: 20, day: 0, monthEnds: [] } },
        },
      },
    }
    const trade = (s: GameState, units: number) =>
      dispatch(s, { type, variety: 'robusta', units } as never)
    const delta = (s: GameState) => Math.abs(s.money - state.money)
    const one = trade(state, n)
    const two = trade(trade(state, n / 2), n / 2)
    const gain = (s: GameState) => s.money - state.money
    expect(gain(two)).toBeLessThanOrEqual(gain(one))
    expect(gain(one) - gain(two)).toBeLessThanOrEqual(100)
    expect(one.market).toEqual(two.market)

    // The unit price of the trade is below (Sell) or above (Buy) the price before the trade.
    // The income or cost rounds to whole CC, so compare it only for large trades.
    const price = type === 'Sell' ? bankBuyPrice : bankSellPrice
    const before = price(state, 'robusta')
    const after = price(state, 'robusta', n)
    if (type === 'Sell') expect(after).toBeLessThan(before)
    else expect(after).toBeGreaterThan(before)
    if (n >= 100 && type === 'Sell') expect(delta(one)).toBeLessThan(n * before * 100)
    if (n >= 100 && type === 'Buy') expect(delta(one)).toBeGreaterThan(n * before * 100)
  })

  it('AC-2: rejects bad trades and keeps the state', () => {
    const state = testState()
    const before = structuredClone(state)
    const bad = [
      { type: 'Buy', variety: 'robusta', units: 5 },
      { type: 'Sell', variety: 'robusta', units: 507 },
      { type: 'Sell', variety: 'arabicaPremium', units: 1 },
      ...(['Sell', 'Buy'] as const).flatMap((type) => [
        { type, variety: 'robusta', units: 0 },
        { type, variety: 'robusta', units: -1 },
        { type, variety: 'robusta', units: 1.5 },
        { type, variety: 'robusta', units: Number.NaN },
        { type, variety: 'mocha', units: 1 },
        { type, variety: 'constructor', units: 1 },
        { type, variety: 'toString', units: 1 },
      ]),
    ] as const
    const poor = { ...state, money: 0 }
    for (const command of bad) {
      const target = command.type === 'Buy' && command.units === 5 ? poor : state
      expect(() => dispatch(target, command as never)).toThrow()
    }
    expect(state).toEqual(before)
  })

  it.each([coffee, seed])('#18: the price of %o moves monotonically with the volume', (good) => {
    const ref =
      good.kind === 'seed' ? cfg.varieties.robusta.seedCost : cfg.varieties.robusta.referencePrice
    const units = good.kind === 'seed' ? m.demandUnitsForHalfFactor : m.supplyUnitsForHalfFactor
    let last = priceAt(good, 0)
    expect(last).toBeCloseTo(ref)
    // Up to ten times the units for the half factor: each step moves the price further.
    for (let volume = 1; volume <= 10 * units; volume += units / 50) {
      const price = priceAt(good, volume)
      if (good.kind === 'seed') expect(price).toBeGreaterThan(last)
      else expect(price).toBeLessThan(last)
      last = price
    }
    // Half the range at the units for the half factor, and never the end of the range.
    expect(priceAt(good, units) / ref).toBeCloseTo((1 + factor(good, 1e9)) / 2)
    if (good.kind === 'seed') expect(last).toBeLessThan(m.demandFactorRange[1]! * ref)
    else expect(last).toBeGreaterThan(m.supplyFactorRange[0]! * ref)
  })

  it.each([
    [coffee, 0, 10],
    [coffee, 800, 2500],
    [seed, 0, 5],
    [seed, 150, 600],
  ] as const)(
    '#18: a trade of %o from volume %i pays the exact mean over %i units',
    (good, from, n) => {
      const ref =
        good.kind === 'seed' ? cfg.varieties.robusta.seedCost : cfg.varieties.robusta.referencePrice
      expect(priceAt(good, from, cfg, n) / ref).toBeCloseTo(meanFactor(good, from, n), 9)
    },
  )

  it('#18: supply lowers the coffee price, which recovers day by day without sales', () => {
    const neutral = bankBuyPrice(testState(), 'robusta')
    const sold = trade(testState(), coffee, [[0, 1000]])
    const drop = (day: number) => neutral - bankBuyPrice(atDay(sold, day), 'robusta')
    expect(drop(0)).toBeGreaterThan(0)
    for (let day = 1; day <= 20 * half; day++) expect(drop(day)).toBeLessThan(drop(day - 1))
    // The volume halves with each half-life.
    expect(volumeOn(sold.market.volumes, coffee, half)).toBeCloseTo(500)
    expect(volumeOn(sold.market.volumes, coffee, 3 * half)).toBeCloseTo(125)
    expect(drop(20 * half)).toBeCloseTo(0, 4)
  })

  it('#18: a later sale adds to the decayed volume, not to the original units', () => {
    const state = trade(testState(), coffee, [
      [0, 400],
      [half, 100],
    ])
    expect(state.market.volumes.coffee?.robusta).toMatchObject({ units: 300, day: half })
    expect(volumeOn(state.market.volumes, coffee, 2 * half)).toBeCloseTo(150)
  })

  it('#18: seed demand raises the seed price and recovers the same way', () => {
    const seedCost = cfg.varieties.robusta.seedCost
    const bought = trade(testState(), seed, [[0, m.demandUnitsForHalfFactor]])
    const rise = (m.demandFactorRange[1]! - 1) / 2
    expect(bankSellPrice(bought, 'robusta')).toBeCloseTo((1 + rise) * seedCost)
    expect(bankSellPrice(atDay(bought, half), 'robusta')).toBeCloseTo(
      factor(seed, m.demandUnitsForHalfFactor / 2) * seedCost,
    )
    expect(bankSellPrice(atDay(bought, 20 * half), 'robusta')).toBeCloseTo(seedCost, 4)
  })

  it('AC-1 (#27, #18): priceHistory gives the price on the last day of each past month', () => {
    const sales: [number, number][] = [
      [10, 300],
      [100, 900],
      [250, 50],
      [400, 2000],
      [425, 70],
    ]
    const state = atDay(trade(testState(), coffee, sales), 431)
    // The volume on a day: each earlier sale, decayed since its day.
    const volume = (day: number) =>
      sales.filter(([d]) => d <= day).reduce((sum, [d, u]) => sum + u * 2 ** (-(day - d) / half), 0)
    const history = priceHistory(state, coffee)
    expect(history).toHaveLength(12)
    expect(history[11]).toBeCloseTo(priceAt(coffee, volume(431)), 12)
    for (let i = 0; i < 11; i++) {
      expect(history[i]).toBeCloseTo(priceAt(coffee, volume(449 - 30 * (11 - i))), 12)
    }
    expect(history[11]).toBe(marketPrice(state.market.volumes, coffee, 431))
  })

  it('AC-2 (#27, #18): a sale on day 400 lowers only the last two months on day 431', () => {
    const sold = trade(testState(), coffee, [[400, 300]])
    const neutral = cfg.varieties.robusta.referencePrice
    const history = priceHistory(atDay(sold, 431), coffee)
    history.forEach((price, i) => {
      if (i >= 10) expect(price).toBeLessThan(neutral)
      else expect(price).toBe(neutral)
    })
  })

  it('#18: the month ends keep at most the months of the history', () => {
    const sales = Array.from({ length: 40 }, (_, k): [number, number] => [k * 45, 10])
    const state = trade(testState(), coffee, sales)
    expect(state.market.volumes.coffee?.robusta?.monthEnds).toHaveLength(m.historyMonths - 1)
    // A sale more than a year after the last one: each past month recovers further.
    const later = trade(state, coffee, [[39 * 45 + 600, 1]])
    expect(later.market.volumes.coffee?.robusta?.monthEnds).toHaveLength(m.historyMonths - 1)
    const past = priceHistory(later, coffee).slice(0, -1)
    past.slice(1).forEach((price, i) => expect(price).toBeGreaterThanOrEqual(past[i]!))
  })

  it('AC-5 (#18): 1,000 random days keep prices in range and the month ends short', () => {
    const rand = mulberry32(12345)
    const pick = () => varieties[Math.floor(rand() * varieties.length)]!
    const goods: Good[] = varieties.flatMap((variety) => [
      { kind: 'coffee', variety },
      { kind: 'seed', variety },
    ])
    let state: GameState = { ...createState(3), money: 1e12 }
    for (let day = 1; day <= 1000; day++) {
      state = atDay(state, day)
      for (let t = Math.floor(rand() * 4); t > 0; t--) {
        const variety = pick()
        const units = 1 + Math.floor(rand() * 4000)
        state = {
          ...state,
          storage: {
            batches: [...state.storage.batches, { variety, units, quality: 100, storedDay: 0 }],
          },
        }
        state = dispatch(state, { type: 'Sell', variety, units })
        state = dispatch(state, {
          type: 'Buy',
          variety: pick(),
          units: 1 + Math.floor(rand() * 3000),
        })
      }
      for (const good of goods) {
        const ref =
          good.kind === 'coffee'
            ? cfg.varieties[good.variety].referencePrice
            : cfg.varieties[good.variety].seedCost
        const prices = [marketPrice(state.market.volumes, good, day), ...priceHistory(state, good)]
        for (const price of prices) {
          expect(price).toBeGreaterThanOrEqual(m.priceFloor * ref - 1e-9)
          expect(price).toBeLessThanOrEqual(m.priceCeiling * ref + 1e-9)
        }
      }
    }
    const volumes: Volumes = state.market.volumes
    for (const byVariety of Object.values(volumes))
      for (const v of Object.values(byVariety))
        expect(v.monthEnds.length).toBeLessThanOrEqual(m.historyMonths - 1)
  })
})

describe('washed coffee (S46)', () => {
  // 10 washed Arabica Standard units from a Process on day 0, and 5 raw units.
  function washedState(): GameState {
    const state = createState(1)
    const raw = { variety: 'arabicaStandard' as const, units: 15, quality: 90, storedDay: 0 }
    return dispatch(
      { ...state, buildings: { 0: { kind: 'processing' } }, storage: { batches: [raw] } },
      { type: 'Process', variety: 'arabicaStandard', units: 10 },
    )
  }
  const sell = (units: number, washed?: true) =>
    ({ type: 'Sell', variety: 'arabicaStandard', units, ...(washed && { washed }) }) as const

  it('AC-3: sells washed units only after 30 days, at the washed price', () => {
    const fresh = washedState()
    expect(() => dispatch(fresh, sell(1, true))).toThrow(/Not enough/)
    const state = { ...fresh, time: { ...fresh.time, day: 30 } }
    const price = bankBuyPrice(state, 'arabicaStandard', 10, true)
    expect(price).toBeCloseTo(1.5 * m.bankBuyFactor * meanFactor(coffee, 0, 10))
    const next = dispatch(state, sell(10, true))
    expect(next.money).toBe(state.money + Math.floor(10 * price) * 100)
    expect(next.storage.batches).toEqual([
      { variety: 'arabicaStandard', units: 5, quality: 90, storedDay: 0 },
    ])
    expect(next.market.volumes).toEqual({
      washed: { arabicaStandard: { units: 10, day: 30, monthEnds: [] } },
    })
    // Washed sales do not lower the raw price.
    expect(bankBuyPrice(next, 'arabicaStandard')).toBeCloseTo(
      bankBuyPrice(state, 'arabicaStandard'),
    )
  })

  it('AC-3: a raw sale never takes washed units, a washed sale never takes raw units', () => {
    const state = { ...washedState(), time: { day: 30, speed: 1, stage: 'months' as const } }
    expect(() => dispatch(state, sell(6))).toThrow(/Not enough/)
    const rawSold = dispatch(state, sell(5))
    expect(rawSold.storage.batches.every((b) => b.washed)).toBe(true)
    expect(Object.keys(rawSold.market.volumes)).toEqual(['coffee'])
    expect(() => dispatch(state, sell(11, true))).toThrow(/Not enough/)
    const washedSold = dispatch(state, sell(10, true))
    expect(washedSold.storage.batches.every((b) => !b.washed)).toBe(true)
  })
})

describe('sell one row (#9)', () => {
  it('sells only the batches of the given quality and storage day', () => {
    const base = createState(1)
    const batches = [
      { variety: 'robusta' as const, units: 6, quality: 80, storedDay: 0 },
      { variety: 'robusta' as const, units: 4, quality: 90, storedDay: 0 },
      { variety: 'robusta' as const, units: 3, quality: 90, storedDay: 30 },
    ]
    const state = { ...base, storage: { batches } }
    const next = dispatch(state, {
      type: 'Sell',
      variety: 'robusta',
      units: 3,
      quality: 90,
      storedDay: 30,
    })
    expect(next.storage.batches).toEqual(batches.slice(0, 2))
    expect(next.money).toBeGreaterThan(state.money)
    expect(() =>
      dispatch(state, { type: 'Sell', variety: 'robusta', units: 5, quality: 90, storedDay: 0 }),
    ).toThrow(/Not enough/)
  })
})
