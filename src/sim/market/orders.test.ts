import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import { step } from '../time/time'
import { dailyOrders, deliverableUnits, type Order } from './orders'

const cfg = balance()
const perDay = cfg.time.ticksPerGameDay

function stepDays(start: GameState, days: number, each?: (s: GameState) => void): GameState {
  let state = start
  for (let d = 0; d < days; d++) {
    for (let h = 0; h < perDay; h++) state = step(state)
    each?.(state)
  }
  return state
}

const order: Order = {
  id: 4,
  variety: 'robusta',
  units: 30,
  minQuality: 80,
  price: 60,
  deadlineDay: 15,
}

// Day 10, one open order, 20 units at quality 75 and 40 units at quality 90.
function withOrder(): GameState {
  const base = createState(9)
  return {
    ...base,
    time: { ...base.time, hour: 9 * perDay },
    storage: {
      batches: [
        { variety: 'robusta', units: 20, quality: 75 },
        { variety: 'robusta', units: 40, quality: 90 },
      ],
    },
    market: { volumes: [{ kind: 'coffee', variety: 'robusta', day: 9, units: 5 }], seeds: {} },
    orders: { open: [order], nextId: 5 },
  }
}

describe('orders (S56)', () => {
  it('AC-1: starts empty and repeats for the same seed', () => {
    expect(createState(3).orders).toEqual({ open: [], nextId: 0 })
    const a = stepDays(createState(3), 60).orders
    expect(stepDays(createState(3), 60).orders).toEqual(a)
    expect(a.nextId).toBeGreaterThan(0)
  })

  it('AC-1: keeps every order within the limit and the config ranges', () => {
    const o = cfg.orders
    const seen = new Map<number, { order: Order; day: number }>()
    let day = 1
    stepDays(createState(11), 1000, (state) => {
      day++
      expect(state.orders.open.length).toBeLessThanOrEqual(o.maxOpen)
      for (const order of state.orders.open) {
        if (!seen.has(order.id)) seen.set(order.id, { order, day })
      }
    })
    expect(seen.size).toBeGreaterThan(50)
    const inRange = (v: number, [min, max]: readonly number[]) => {
      expect(v).toBeGreaterThanOrEqual(min!)
      expect(v).toBeLessThanOrEqual(max!)
    }
    for (const { order, day } of seen.values()) {
      const variety = cfg.varieties[order.variety]
      expect(variety.unlockCapital).toBe(0)
      inRange(order.units, o.units)
      inRange(order.minQuality, o.minQuality)
      inRange(order.deadlineDay - day, o.deadlineDays)
      const ref = variety.referencePrice * 100
      inRange(order.price, [Math.round(ref * o.priceFactor[0]), Math.round(ref * o.priceFactor[1])])
      expect(order.price).toBeGreaterThan(Math.round(ref * cfg.market.bankBuyFactor))
      expect(Number.isInteger(order.price)).toBe(true)
    }
  })

  it('AC-2: delivers from the qualifying batches only and pays at once', () => {
    const state = withOrder()
    expect(deliverableUnits(state, order)).toBe(40)
    const next = dispatch(state, { type: 'DeliverOrder', id: 4 })
    expect(next.money).toBe(state.money + 1800)
    expect(next.storage.batches).toEqual([
      { variety: 'robusta', units: 20, quality: 75 },
      { variety: 'robusta', units: 10, quality: 90 },
    ])
    expect(next.orders).toEqual({ open: [], nextId: 5 })
    expect(next.market).toEqual(state.market)
  })

  it('AC-2: takes the oldest qualifying batch first', () => {
    const state = withOrder()
    const batches = [
      { variety: 'robusta' as const, units: 25, quality: 85 },
      { variety: 'arabicaStandard' as const, units: 50, quality: 99 },
      { variety: 'robusta' as const, units: 25, quality: 95 },
    ]
    const next = dispatch({ ...state, storage: { batches } }, { type: 'DeliverOrder', id: 4 })
    expect(next.storage.batches).toEqual([batches[1], { ...batches[2], units: 20 }])
  })

  it('S46: never takes washed batches', () => {
    const state = withOrder()
    const washed = { variety: 'robusta' as const, units: 25, quality: 95, washed: true as const }
    const batches = [washed, { variety: 'robusta' as const, units: 30, quality: 95 }]
    const next = dispatch({ ...state, storage: { batches } }, { type: 'DeliverOrder', id: 4 })
    expect(deliverableUnits({ ...state, storage: { batches } }, order)).toBe(30)
    expect(next.storage.batches).toEqual([washed])
    const few = { ...state, storage: { batches: [{ ...washed, units: 100 }] } }
    expect(() => dispatch(few, { type: 'DeliverOrder', id: 4 })).toThrow(/Not enough/)
  })

  it('AC-3: throws and keeps the state for a bad delivery', () => {
    const state = withOrder()
    const copy = structuredClone(state)
    expect(() => dispatch(state, { type: 'DeliverOrder', id: 99 })).toThrow(/99/)
    // 20 low quality units plus 20 qualifying units are not enough.
    const few = {
      ...state,
      storage: {
        batches: [
          { variety: 'robusta' as const, units: 20, quality: 75 },
          { variety: 'robusta' as const, units: 20, quality: 90 },
        ],
      },
    }
    expect(deliverableUnits(few, order)).toBe(20)
    expect(() => dispatch(few, { type: 'DeliverOrder', id: 4 })).toThrow(/20/)
    const late = { ...state, time: { ...state.time, hour: 15 * perDay } }
    expect(() => dispatch(late, { type: 'DeliverOrder', id: 4 })).toThrow(/deadline/)
    expect(state).toEqual(copy)
  })

  it('AC-3: keeps the order on the deadline day and drops it on the next day', () => {
    // The last hour of day 14: the next step starts day 15.
    const state = { ...withOrder(), time: { hour: 14 * perDay - 1, speed: 1 } }
    const day15 = step(state)
    expect(day15.orders.open.map((o) => o.id)).toContain(4)
    expect(dispatch(day15, { type: 'DeliverOrder', id: 4 }).orders.open).not.toContainEqual(order)
    const day16 = stepDays(day15, 1)
    expect(day16.orders.open.map((o) => o.id)).not.toContain(4)
  })

  it('AC-3: an expired order changes no other state field', () => {
    const full = [order, { ...order, id: 1, deadlineDay: 20 }, { ...order, id: 2, deadlineDay: 20 }]
    const base = withOrder()
    const state = {
      ...base,
      time: { ...base.time, hour: 15 * perDay },
      orders: { open: full, nextId: 5 },
    }
    const next = dailyOrders(state)
    expect(next.orders.open.map((o) => o.id)).not.toContain(4)
    expect({ ...next, orders: state.orders }).toEqual(state)
  })
})
