import { describe, expect, it } from 'vitest'
import { balance } from './balance'
import { buildMenu } from './buildings/build'
import { dispatch, type Command } from './commands'
import { isFree, quoteParcels } from './farm/parcels'
import { quotePlant } from './farm/plants'
import type { Variety } from './farm/yield'
import { roundCost, roundIncome } from './money'
import { processCost } from './processing/process'
import { createState, type GameState } from './state'
import { monthlyUpkeep } from './storage/daily'
import { step } from './time/time'
import type { Parcel, World } from './world/types'

const size = 5

// Flat lowland with soilQuality 0.6 everywhere, so the parcel price factor is 1.1. (1,1) is highland.
function testWorld(): World {
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const zone = x === 1 && y === 1 ? 'hochland' : 'tiefland'
      const soil = { fertility: 70, waterRetention: 50, soilQuality: 0.6 }
      parcels.push({ x, y, height: 0.2, zone, ...soil, soilClass: 'gut' })
    }
  }
  return { seed: 0, size, parcels, start: { x: 2, y: 2 } }
}

// An empty market and an empty storage.
const testState = (money = 50000): GameState => ({
  ...createState(1),
  world: testWorld(),
  props: { hut: { x: 4, y: 4 }, market: { x: 4, y: 4 }, path: [], trees: [] },
  money,
})

// Owns the parcels 0 to 3 of row 0 with one plant of the variety on each listed parcel.
function planted(plants: Record<number, Variety>, money = 50000): GameState {
  const state = testState(money)
  return {
    ...state,
    farm: {
      ...state.farm,
      parcels: { 0: 0, 1: 0, 2: 0, 3: 0 },
      fields: [{ id: 0, name: 'A' }],
      plants: Object.fromEntries(
        Object.entries(plants).map(([i, variety]) => [i, { variety, plantedDay: 0 }]),
      ),
    },
  }
}

const withStock = (state: GameState, units: number, washed = false): GameState => ({
  ...state,
  storage: {
    batches: units ? [{ variety: 'robusta', units, quality: 90, ...(washed && { washed }) }] : [],
  },
})

const spent = (before: GameState, command: Command) =>
  before.money - dispatch(before, command).money

describe('roundCost and roundIncome', () => {
  it('round hundredths of CC up or down to whole CC', () => {
    expect([0, 1, 99, 100, 101].map(roundCost)).toEqual([0, 100, 100, 100, 200])
    expect([0, 1, 99, 100, 199, -50].map(roundIncome)).toEqual([0, 0, 0, 100, 100, -100])
  })
})

describe('S57 costs round up per booking', () => {
  it('AC-1: parcels', () => {
    const first = testState()
    const highland = [{ x: 1, y: 1 }]
    expect(quoteParcels(first, highland)).toBe(2300)
    const owned = dispatch(first, { type: 'CreateParcels', parcels: highland })
    expect(first.money - owned.money).toBe(2300)
    expect(owned.invested).toBe(2300)

    const one = [{ x: 3, y: 1 }]
    const two = [...one, { x: 3, y: 3 }]
    expect(quoteParcels(owned, one)).toBe(2800)
    expect(quoteParcels(owned, two)).toBe(5500)
    for (const [list, cost] of [
      [one, 2800],
      [two, 5500],
    ] as const) {
      const next = dispatch(owned, { type: 'CreateParcels', parcels: [...list] })
      expect(owned.money - next.money).toBe(cost)
      expect(next.invested - owned.invested).toBe(cost)
    }
  })

  it('AC-1: seed', () => {
    const state = testState()
    expect(spent(state, { type: 'Buy', variety: 'robusta', units: 3 })).toBe(700)
    expect(quotePlant(state, 'robusta', 3)).toBe(700)
  })

  it('AC-1: care', () => {
    const robusta = planted({ 0: 'robusta', 1: 'robusta', 2: 'robusta' })
    const parcels = [0, 1, 2].map((x) => ({ x, y: 0 }))
    expect(spent(robusta, { type: 'Fertilize', parcels })).toBe(300)
    const arabica = planted({ 0: 'arabicaStandard' })
    expect(spent(arabica, { type: 'Fertilize', parcels: [{ x: 0, y: 0 }] })).toBe(200)
  })

  it('AC-1: build', () => {
    const costs = Object.fromEntries(buildMenu(testState()).map((e) => [e.kind, e.cost]))
    expect(costs).toEqual({ processing: 15000, storage: 15000 })
  })

  it('AC-1: processing', () => {
    const state = {
      ...withStock(testState(), 60),
      buildings: { 0: { kind: 'processing' as const } },
    }
    const cost = (units: number) => spent(state, { type: 'Process', variety: 'robusta', units })
    expect([cost(7), processCost(7)]).toEqual([300, 300])
    expect([cost(50), processCost(50)]).toEqual([1500, 1500])
  })

  it('AC-1: storage per month', () => {
    const day = (units: number) => {
      const state = withStock(testState(), units)
      return state.money - monthlyUpkeep(state).money
    }
    expect([day(30), day(50), day(51), day(0)]).toEqual([100, 100, 200, 0])
  })
})

describe('S57 income rounds down per booking', () => {
  it('AC-2: a bank sale', () => {
    const state = withStock(testState(), 10)
    expect(-spent(state, { type: 'Sell', variety: 'robusta', units: 10 })).toBe(300)
  })

  it('AC-2: an order delivery', () => {
    const order = {
      id: 0,
      variety: 'robusta' as const,
      units: 30,
      minQuality: 0,
      price: 59,
      deadlineDay: 9,
    }
    const state = { ...withStock(testState(), 30), orders: { open: [order], nextId: 1 } }
    expect(-spent(state, { type: 'DeliverOrder', id: 0 })).toBe(1700)
    expect(state.orders.open[0]!.price).toBe(59)
  })
})

describe('S57 the balance is always whole', () => {
  it('AC-3: holds whole CC after each command and game day', () => {
    let state = createState(42)
    const check = (label: string) => {
      expect(state.money % 100, `${label} money ${state.money}`).toBe(0)
      expect(state.invested % 100, `${label} invested ${state.invested}`).toBe(0)
    }
    const run = (command: Command) => {
      state = dispatch(state, command)
      check(command.type)
    }
    const days = (n: number) => {
      for (let i = 0; i < n; i++) {
        state = step(state)
        check(`day ${state.time.day}`)
      }
    }
    const { world } = state
    const free = world.parcels.filter((p) => p.zone === 'tiefland' && isFree(state, p.x, p.y))
    const [a, b, c, d] = free.map(({ x, y }) => ({ x, y }))
    check('start')

    run({ type: 'CreateParcels', parcels: [a!, b!, c!] })
    run({ type: 'CreateParcels', parcels: [d!] })
    run({ type: 'Buy', variety: 'robusta', units: 1 })
    run({ type: 'Plant', variety: 'robusta', parcels: [a!, b!] })
    run({ type: 'Fertilize', parcels: [a!, b!] })
    run({ type: 'Irrigate', parcels: [a!] })
    run({ type: 'Build', building: 'processing', parcel: c! })
    days(balance().varieties.robusta.cycleDays)
    run({ type: 'Harvest', parcels: [a!, b!] })
    days(30)

    const raw = () => state.storage.batches.reduce((sum, x) => sum + (x.washed ? 0 : x.units), 0)
    const order = {
      id: 99,
      variety: 'robusta' as const,
      units: 13,
      minQuality: 0,
      price: 59,
      deadlineDay: 9999,
    }
    state = { ...state, orders: { ...state.orders, open: [...state.orders.open, order] } }
    run({ type: 'DeliverOrder', id: 99 })
    run({ type: 'Process', variety: 'robusta', units: 7 })
    run({ type: 'Sell', variety: 'robusta', units: raw() - 3 })
    days(60)
    run({ type: 'Sell', variety: 'robusta', units: 7, washed: true })
    run({ type: 'Sell', variety: 'robusta', units: raw() })
  })

  it('AC-3: a cost equal to the balance passes, a cost above it after rounding throws', () => {
    const buy: Command = { type: 'Buy', variety: 'robusta', units: 3 }
    expect(dispatch(testState(700), buy).money).toBe(0)
    // 6.0135 CC is less than 6.5 CC, but the booking is 7 CC.
    expect(() => dispatch(testState(650), buy)).toThrow(/Not enough money/)

    const stock = {
      ...withStock(testState(300), 7),
      buildings: { 0: { kind: 'processing' as const } },
    }
    const process: Command = { type: 'Process', variety: 'robusta', units: 7 }
    expect(dispatch(stock, process).money).toBe(0)
    expect(() => dispatch({ ...stock, money: 250 }, process)).toThrow(/Not enough money/)
  })
})
