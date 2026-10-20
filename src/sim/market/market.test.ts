import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import type { Variety } from '../farm/yield'
import { mulberry32 } from '../rng'
import { createState, type GameState } from '../state'
import { bankBuyPrice, bankSellPrice, marketPrice, priceHistory, type Good } from './market'

const cfg = balance()
const m = cfg.market
const hoursPerDay = cfg.time.ticksPerGameDay
const varieties = Object.keys(cfg.varieties) as Variety[]

// Stores two old Robusta batches and one Arabica batch, oldest first.
function testState(): GameState {
  const state = createState(1)
  return {
    ...state,
    storage: {
      batches: [
        { variety: 'robusta', units: 6, quality: 90 },
        { variety: 'arabicaStandard', units: 5, quality: 100 },
        { variety: 'robusta', units: 500, quality: 100 },
      ],
    },
  }
}

const atDay = (state: GameState, day: number): GameState => ({
  ...state,
  time: { ...state.time, hour: (day - 1) * hoursPerDay },
})

describe('market', () => {
  it('AC-1: the bank buys Robusta for 0.4 CC at a neutral market', () => {
    const state = testState()
    expect(bankBuyPrice(state, 'robusta')).toBeCloseTo(0.4)
    const next = dispatch(state, { type: 'Sell', variety: 'robusta', units: 10 })
    expect(next.money).toBe(state.money + 400)
    expect(next.storage.batches).toEqual([
      { variety: 'arabicaStandard', units: 5, quality: 100 },
      { variety: 'robusta', units: 496, quality: 100 },
    ])
  })

  it('AC-2: Buy charges the config seed price and adds to the seed stock', () => {
    const state = testState()
    const seedCost = cfg.varieties.robusta.seedCost
    expect(bankSellPrice(state, 'robusta')).toBeCloseTo(seedCost)
    const next = dispatch(state, { type: 'Buy', variety: 'robusta', units: 5 })
    expect(next.money).toBe(state.money - Math.round(5 * seedCost * 100))
    expect(next.market.seeds.robusta).toBe(5)
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
      ]),
    ] as const
    const poor = { ...state, money: 0 }
    for (const command of bad) {
      const target = command.type === 'Buy' && command.units === 5 ? poor : state
      expect(() => dispatch(target, command as never)).toThrow()
    }
    expect(state).toEqual(before)
  })

  it('AC-3: supply lowers the coffee price, which recovers after the window', () => {
    const neutral = bankBuyPrice(testState(), 'robusta')
    let state: GameState = {
      ...testState(),
      storage: {
        batches: [{ variety: 'robusta', units: m.supplyUnitsForMinFactor, quality: 100 }],
      },
    }
    state = dispatch(state, { type: 'Sell', variety: 'robusta', units: m.supplyUnitsForMinFactor })
    expect(bankBuyPrice(state, 'robusta')).toBeCloseTo(0.7 * neutral)
    expect(bankBuyPrice(atDay(state, m.volumeWindowDays), 'robusta')).toBeCloseTo(0.7 * neutral)
    expect(bankBuyPrice(atDay(state, 1 + m.volumeWindowDays), 'robusta')).toBeCloseTo(neutral)
  })

  it('AC-3: demand raises the seed price to 1.3 × seedCost', () => {
    const state = dispatch(
      { ...testState(), money: 1e9 },
      { type: 'Buy', variety: 'robusta', units: m.demandUnitsForMaxFactor },
    )
    expect(bankSellPrice(state, 'robusta')).toBeCloseTo(1.3 * cfg.varieties.robusta.seedCost)
  })

  it('AC-4: priceHistory gives one price per day, and a sale shows for the window days', () => {
    const day = 20
    const sold = dispatch(atDay(testState(), day), { type: 'Sell', variety: 'robusta', units: 300 })
    const good: Good = { kind: 'coffee', variety: 'robusta' }
    const neutral = cfg.varieties.robusta.referencePrice
    const low = marketPrice(sold.market, good, day)
    expect(low).toBeLessThan(neutral)

    const later = atDay(sold, day + 5)
    const history = priceHistory(later, good)
    expect(history).toHaveLength(m.historyDays)
    // The last entry is day + 5, so day N has index historyDays − 6.
    const first = m.historyDays - 6
    history.forEach((price, i) => {
      const inWindow = i >= first && i < first + m.volumeWindowDays
      expect(price).toBeCloseTo(inWindow ? low : neutral)
    })
  })

  it('AC-5: 1,000 random days keep prices in range and the volumes small', () => {
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
        const units = 1 + Math.floor(rand() * 400)
        state = {
          ...state,
          storage: { batches: [...state.storage.batches, { variety, units, quality: 100 }] },
        }
        state = dispatch(state, { type: 'Sell', variety, units })
        state = dispatch(state, {
          type: 'Buy',
          variety: pick(),
          units: 1 + Math.floor(rand() * 300),
        })
      }
      for (const good of goods) {
        const ref =
          good.kind === 'coffee'
            ? cfg.varieties[good.variety].referencePrice
            : cfg.varieties[good.variety].seedCost
        const price = marketPrice(state.market, good, day)
        expect(price).toBeGreaterThanOrEqual(m.priceFloor * ref - 1e-9)
        expect(price).toBeLessThanOrEqual(m.priceCeiling * ref + 1e-9)
      }
      expect(state.market.volumes.length).toBeLessThanOrEqual(
        (m.historyDays + m.volumeWindowDays) * goods.length,
      )
    }
  })
})
