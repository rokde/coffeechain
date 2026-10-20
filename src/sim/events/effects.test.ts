import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { harvestSeed } from '../farm/harvest'
import type { PlantState } from '../farm/plants'
import { computeYield, yieldRandom, type Variety } from '../farm/yield'
import { bankBuyPrice, bankSellPrice, priceHistory } from '../market/market'
import { mulberry32 } from '../rng'
import { createState, type GameState } from '../state'
import { clock, step } from '../time/time'
import type { Parcel, World, Zone } from '../world/types'
import { priceEventFactor, yieldEventFactor } from './effects'
import { activeEvents, type EventType, type GameEvent } from './schedule'

const cfg = balance()
const ticks = cfg.time.ticksPerGameDay
const max = cfg.events.maxEffect
const seed = 7
const varieties = Object.keys(cfg.varieties) as Variety[]
const hour = 20 * ticks + 5
const day = clock(hour).day

// Row 0 holds one parcel per zone. Rows 1 to 3 are Tiefland.
const zones: Zone[] = ['tiefland', 'hochland', 'hochlandKuehl', 'vulkan']
const crops: Variety[] = ['robusta', 'arabicaStandard', 'arabicaPremium', 'specialty']

function testState(...types: EventType[]): GameState {
  const state = createState(1)
  const size = 4
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const zone = y === 0 ? zones[x]! : 'tiefland'
      const soil = { fertility: 50, waterRetention: 50, soilQuality: 0.5 }
      parcels.push({ x, y, height: 0.3, zone, ...soil, soilClass: 'gut' })
    }
  }
  const world: World = { seed, size, parcels, start: { x: 0, y: 1 } }
  const plants: Record<number, PlantState> = {}
  crops.forEach((variety, i) => {
    plants[i] = { variety, plantedHour: hour - cfg.varieties[variety].cycleDays * ticks }
  })
  const events: GameEvent[] = types.map((type) => ({
    type,
    announcedDay: day - 1,
    startDay: day,
    endDay: day + 2,
  }))
  return {
    ...state,
    world,
    time: { ...state.time, hour },
    farm: { ...state.farm, parcels: { 0: 0, 1: 0, 2: 0, 3: 0 }, plants },
    events,
  }
}

const harvested = (state: GameState, index: number): number => {
  const x = index % state.world.size
  const y = Math.floor(index / state.world.size)
  const next = dispatch(state, { type: 'Harvest', parcels: [{ x, y }] })
  return next.storage.batches.reduce((sum, b) => sum + b.units, 0)
}

const expectedYield = (index: number, eventFactor: number) =>
  computeYield({
    variety: crops[index]!,
    soilClass: 'gut',
    zoneMatches: true,
    fertilized: false,
    eventFactor,
    random: yieldRandom(mulberry32(harvestSeed(seed, hour, index))),
  })

const priceRatio = (state: GameState, variety: Variety) =>
  bankBuyPrice(state, variety) / bankBuyPrice(testState(), variety)

describe('event effects', () => {
  it('AC-1: frost cuts the Hochland yield to 70 % and leaves Tiefland alone', () => {
    const frost = testState('frost')
    expect(harvested(frost, 1)).toBe(expectedYield(1, 0.7))
    expect(harvested(frost, 2)).toBe(expectedYield(2, 0.7))
    expect(harvested(frost, 1)).toBeLessThan(harvested(testState(), 1))
    expect(harvested(frost, 0)).toBe(harvested(testState(), 0))
    expect(harvested(frost, 0)).toBe(expectedYield(0, 1))
  })

  it('AC-1: frost raises the Arabica prices by 20 % and leaves Robusta alone', () => {
    const frost = testState('frost')
    expect(priceRatio(frost, 'arabicaStandard')).toBeCloseTo(1.2)
    expect(priceRatio(frost, 'arabicaPremium')).toBeCloseTo(1.2)
    expect(priceRatio(frost, 'robusta')).toBeCloseTo(1)
  })

  it.each<[EventType, Record<Variety, number>]>([
    ['monsoon', { robusta: 1.15, arabicaStandard: 1, arabicaPremium: 1, specialty: 1 }],
    ['boom', { robusta: 1.15, arabicaStandard: 1.15, arabicaPremium: 1.15, specialty: 1.15 }],
    ['crisis', { robusta: 0.85, arabicaStandard: 0.85, arabicaPremium: 0.85, specialty: 0.85 }],
  ])('AC-2: %s changes the bank prices of coffee', (type, ratios) => {
    const state = testState(type)
    for (const v of varieties) expect(priceRatio(state, v)).toBeCloseTo(ratios[v])
  })

  it('AC-2: seed prices never change, and no event keeps all prices as before', () => {
    const neutral = testState()
    for (const type of ['frost', 'monsoon', 'boom', 'crisis', 'pests'] as const) {
      for (const v of varieties) {
        expect(bankSellPrice(testState(type), v)).toBe(bankSellPrice(neutral, v))
        const seedHistory = priceHistory(testState(type), { kind: 'seed', variety: v })
        expect(seedHistory).toEqual(priceHistory(neutral, { kind: 'seed', variety: v }))
      }
    }
    for (const v of varieties) {
      const ref = cfg.varieties[v].referencePrice
      expect(bankBuyPrice(neutral, v)).toBeCloseTo(ref * cfg.market.bankBuyFactor)
      expect(priceEventFactor(neutral, v, day)).toBe(1)
    }
  })

  it('AC-2: priceHistory shows the event factor on the active days', () => {
    const history = priceHistory(testState('boom'), { kind: 'coffee', variety: 'robusta' })
    const neutral = priceHistory(testState(), { kind: 'coffee', variety: 'robusta' })
    expect(history.at(-1)! / neutral.at(-1)!).toBeCloseTo(1.15)
    expect(history.at(-2)).toBe(neutral.at(-2))
  })

  it('AC-3: pests cut each Tiefland parcel by 20 % to 30 %, the same for the same seed', () => {
    const state = testState('pests')
    const tiefland = state.world.parcels.flatMap((p, i) => (p.zone === 'tiefland' ? [i] : []))
    const factors = tiefland.map((i) => yieldEventFactor(state, i, day))
    for (const f of factors) {
      expect(f).toBeGreaterThanOrEqual(0.7)
      expect(f).toBeLessThanOrEqual(0.8)
    }
    expect(new Set(factors).size).toBeGreaterThan(1)
    expect(tiefland.map((i) => yieldEventFactor(testState('pests'), i, day))).toEqual(factors)
    const later = {
      ...state,
      events: state.events.map((e) => ({ ...e, startDay: e.startDay - 1 })),
    }
    expect(tiefland.map((i) => yieldEventFactor(later, i, day))).not.toEqual(factors)
    for (const i of [1, 2, 3]) expect(yieldEventFactor(state, i, day)).toBe(1)
    expect(harvested(state, 0)).toBe(expectedYield(0, factors[0]!))
  })

  it('AC-3: pest control halves the pest loss', () => {
    const state = testState('pests')
    const loss = 1 - yieldEventFactor(state, 0, day)
    const plant = { ...state.farm.plants[0]!, pestProtected: true }
    const guarded = {
      ...state,
      farm: { ...state.farm, plants: { ...state.farm.plants, 0: plant } },
    }
    expect(1 - yieldEventFactor(guarded, 0, day)).toBeCloseTo(
      loss * cfg.farm.pestControlLossReduction,
    )
  })

  it('AC-4: frost and boom give 1.3 for Arabica, not 1.38', () => {
    expect(priceEventFactor(testState('frost', 'boom'), 'arabicaStandard', day)).toBeCloseTo(1.3)
  })

  it('AC-4: no combination of events leaves ±maxEffect', () => {
    const types: EventType[] = ['frost', 'monsoon', 'boom', 'crisis', 'pests']
    for (let mask = 0; mask < 1 << types.length; mask++) {
      const state = testState(...types.filter((_, i) => mask & (1 << i)))
      for (let i = 0; i < state.world.parcels.length; i++) {
        const f = yieldEventFactor(state, i, day)
        expect(f).toBeGreaterThanOrEqual(1 - max)
        expect(f).toBeLessThanOrEqual(1 + max)
      }
      for (const v of varieties) {
        const f = priceEventFactor(state, v, day)
        expect(f).toBeGreaterThanOrEqual(1 - max)
        expect(f).toBeLessThanOrEqual(1 + max)
      }
    }
  })

  it('S51b AC-3: a harvest with one research breakthrough uses the bonus factor', () => {
    const bonus = 1 + cfg.events.types.research.yieldBonus
    const state = { ...testState(), research: [day] }
    for (const i of [0, 1]) expect(harvested(state, i)).toBe(expectedYield(i, bonus))
    expect(harvested(state, 0)).toBeGreaterThan(harvested(testState(), 0))
  })

  it('S51b AC-4: research and frost on Hochland stay within ±maxEffect', () => {
    for (const research of [[day], [day, day], [day, day, day]]) {
      const state = { ...testState('frost'), research }
      const f = yieldEventFactor(state, 1, day)
      expect(f).toBeGreaterThanOrEqual(1 - max)
      expect(f).toBeLessThanOrEqual(1 + max)
    }
    expect(yieldEventFactor({ ...testState('frost'), research: [day] }, 1, day)).toBeCloseTo(
      0.7 * (1 + cfg.events.types.research.yieldBonus),
    )
  })

  // Non-boundary ticks only add 1 to the hour, so one step from the last hour of the day is enough.
  const nextDay = (state: GameState) =>
    step({ ...state, time: { ...state.time, hour: clock(state.time.hour).day * ticks - 1 } })

  it('one step from the last hour of the day equals 24 single steps over 30 days', () => {
    let slow = createState(3)
    let fast = createState(3)
    for (let d = 0; d < 30; d++) {
      for (let h = 0; h < ticks; h++) slow = step(slow)
      fast = nextDay(fast)
    }
    expect(fast).toEqual(slow)
  })

  it('AC-5: 1,000 days on 20 seeds keep at most 2 active events and factors in [0.7, 1.3]', () => {
    for (let s = 1; s <= 20; s++) {
      let state = createState(s)
      let most = 0
      let low = 1
      let high = 1
      const check = (f: number) => {
        low = Math.min(low, f)
        high = Math.max(high, f)
      }
      // The factors depend only on the active events, so each set of active events is checked once.
      const checked = new Set<string>()
      for (let d = 1; d <= 1000; d++) {
        const active = activeEvents(state, d)
        most = Math.max(most, active.length)
        const key = JSON.stringify(active)
        if (!checked.has(key)) {
          checked.add(key)
          for (let i = 0; i < state.world.parcels.length; i++) {
            check(yieldEventFactor(state, i, d))
          }
          for (const v of varieties) check(priceEventFactor(state, v, d))
        }
        state = nextDay(state)
      }
      expect(most).toBe(2)
      expect(low).toBeGreaterThanOrEqual(0.7)
      expect(high).toBeLessThanOrEqual(1.3)
    }
  })
})
