import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import { step } from '../time/time'
import { growth } from '../farm/plants'
import type { Parcel } from '../world/types'
import { deserialize, SAVE_VERSION, serialize } from './save'

const perDay = () => balance().time.ticksPerGameDay

// A flat 4x4 world with two planted Robusta parcels.
function populated(): GameState {
  const size = 4
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const soil = { fertility: 50, waterRetention: 50, soilQuality: 0.5 }
      parcels.push({ x, y, height: 0.2, zone: 'tiefland', ...soil, soilClass: 'gut' })
    }
  }
  const base = createState(3)
  let state: GameState = {
    ...base,
    world: { seed: 3, size, parcels, start: { x: 3, y: 3 } },
  }
  const two = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]
  state = dispatch(state, { type: 'CreateParcels', parcels: two })
  return dispatch(state, { type: 'Plant', variety: 'robusta', parcels: two })
}

function runDays(start: GameState, days: number): GameState {
  let state = start
  for (let hour = 0; hour < days * perDay(); hour++) {
    state = step(state)
    if (hour % perDay() !== 0) continue
    const ripe = [0, 1]
      .filter((x) => {
        const plant = state.farm.plants[x]
        return plant && growth(plant, state.time.hour).progress >= 1
      })
      .map((x) => ({ x, y: 0 }))
    if (ripe.length === 0) continue
    state = dispatch(state, { type: 'Harvest', parcels: ripe })
    state = dispatch(state, { type: 'Plant', variety: 'robusta', parcels: ripe })
    const units = state.storage.batches.reduce((sum, b) => sum + b.units, 0)
    if (units > 0) state = dispatch(state, { type: 'Sell', variety: 'robusta', units })
  }
  return state
}

describe('save format', () => {
  it('AC-1: round-trips a new and a populated state', () => {
    const fresh = createState(5)
    expect(deserialize(serialize(fresh))).toEqual(fresh)
    const state = runDays(populated(), 40)
    expect(state.storage.batches.length + state.market.volumes.length).toBeGreaterThan(0)
    expect(deserialize(serialize(state))).toEqual(state)
  })

  it('AC-2: save, load and 50 more days equal 50 days without a break', () => {
    const a = populated()
    const direct = runDays(a, 50)
    const loaded = runDays(deserialize(serialize(a)), 50)
    expect(loaded).toEqual(direct)
  })

  it('AC-3: rejects missing, invalid and newer versions', () => {
    const state = createState(1)
    const text = (version: unknown) => JSON.stringify({ version, state })
    expect(() => deserialize(text(SAVE_VERSION + 1))).toThrow(`${SAVE_VERSION + 1}`)
    for (const bad of [undefined, 1.5, '1', 0, -1]) {
      expect(() => deserialize(text(bad))).toThrow(/version/)
    }
  })

  it('AC-4: rejects text that is not JSON or has no state', () => {
    expect(() => deserialize('{nope')).toThrow(/JSON/)
    expect(() => deserialize(JSON.stringify({ version: 1 }))).toThrow(/state/)
    expect(() => deserialize(JSON.stringify({ version: 1, state: 3 }))).toThrow(/state/)
    expect(() => deserialize('[]')).toThrow(/state/)
  })

  it('AC-5: runs migrations in order', () => {
    // The migrations set the money of a valid state from the fields a and b.
    const state = createState(1)
    const text = JSON.stringify({ version: 1, state: { ...state, a: 1 } })
    const m1 = (s: Record<string, unknown>) => ({ ...s, b: 2 })
    const m2 = (s: Record<string, unknown>) => ({ ...s, money: Number(s.a) * 10 + Number(s.b) })
    const format = { version: 3, migrations: [m1, m2] }
    expect(deserialize(text, format).money).toBe(12)
    const v2 = JSON.stringify({ version: 2, state: { ...state, a: 1, b: 5 } })
    expect(deserialize(v2, format).money).toBe(15)
  })

  describe('S42 schema check', () => {
    const save = (change: (state: Record<string, unknown>) => void) => {
      const state = structuredClone(createState(1)) as unknown as Record<string, unknown>
      change(state)
      return JSON.stringify({ version: SAVE_VERSION, state })
    }

    it('AC-1: names the bad field', () => {
      expect(() => deserialize(save((s) => (s.money = 'a lot')))).toThrow(/money/)
      expect(() =>
        deserialize(save((s) => ((s.world as Record<string, unknown>).parcels = 3))),
      ).toThrow(/world\.parcels/)
      expect(() => deserialize(save((s) => delete s.farm))).toThrow(/farm/)
    })

    it('AC-1: checks the events and milestones', () => {
      expect(() => deserialize(save((s) => (s.events = [{ type: 'flood' }])))).toThrow(
        /events\.0\.type/,
      )
      expect(() => deserialize(save((s) => (s.milestones = { harvested: '1' })))).toThrow(
        /milestones\.harvested/,
      )
    })

    it('AC-1: checks nested fields and unknown varieties', () => {
      const plant = (variety: unknown) =>
        save((s) => {
          ;(s.farm as { plants: Record<number, unknown> }).plants[0] = { variety, plantedHour: 0 }
        })
      expect(deserialize(plant('robusta')).farm.plants[0]?.variety).toBe('robusta')
      expect(() => deserialize(plant('tea'))).toThrow(/farm\.plants\.0\.variety/)
    })
  })

  it('loads a version 1 save with the events and milestones defaults', () => {
    const old: Record<string, unknown> = { ...createState(1) }
    delete old.events
    delete old.milestones
    const loaded = deserialize(JSON.stringify({ version: 1, state: old }))
    expect(loaded.milestones).toEqual({ harvested: 0 })
    expect(loaded).toEqual(createState(1))
  })

  it('loads a version 2 save with the milestones default', () => {
    const old: Record<string, unknown> = { ...createState(1) }
    delete old.milestones
    const loaded = deserialize(JSON.stringify({ version: 2, state: old }))
    expect(loaded).toEqual(createState(1))
  })
})

describe('events migration', () => {
  it('loads a version 1 save with an empty event list', () => {
    const old: Record<string, unknown> = { ...createState(5) }
    delete old.events
    delete old.milestones
    const loaded = deserialize(JSON.stringify({ version: 1, state: old }))
    expect(loaded.events).toEqual([])
    expect(loaded).toEqual(createState(5))
  })
})

describe('research migration', () => {
  it('S51b AC-5: has version 4 and loads a version 3 save with an empty research list', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(4)
    const old: Record<string, unknown> = { ...createState(5) }
    delete old.research
    const loaded = deserialize(JSON.stringify({ version: 3, state: old }))
    expect(loaded.research).toEqual([])
    expect(loaded).toEqual(createState(5))
  })

  it('S51b AC-5: round-trips research days and rejects bad ones', () => {
    const text = serialize({ ...createState(5), research: [12, 40] })
    expect(deserialize(text).research).toEqual([12, 40])
    expect(serialize(deserialize(text))).toBe(text)
    const bad = JSON.stringify({ version: 4, state: { ...createState(5), research: ['x'] } })
    expect(() => deserialize(bad)).toThrow(/research/)
  })
})

describe('washed batches (S46)', () => {
  it('AC-4: round-trips washed batches and loads a version 5 save without them', () => {
    const base = createState(5)
    const state: GameState = {
      ...base,
      storage: {
        batches: [
          { variety: 'robusta', units: 3, quality: 80 },
          { variety: 'robusta', units: 7, quality: 80, washed: true, readyHour: 24 },
        ],
      },
      market: {
        ...base.market,
        volumes: [{ kind: 'washed', variety: 'robusta', day: 1, units: 2 }],
      },
    }
    expect(deserialize(serialize(state))).toEqual(state)
    const old = JSON.stringify({
      version: 5,
      state: { ...base, storage: { batches: [{ variety: 'robusta', units: 3, quality: 80 }] } },
    })
    const raw = { variety: 'robusta', units: 3, quality: 80, readyHour: 24 }
    const bad = serialize({ ...base, storage: { batches: [raw as never] } })
    expect(() => deserialize(bad)).toThrow(/readyHour needs washed/)
    expect(deserialize(old).storage.batches).toEqual([
      { variety: 'robusta', units: 3, quality: 80 },
    ])
  })
})

describe('orders migration (S56)', () => {
  it('AC-4: round-trips two open orders', () => {
    const order = { id: 0, variety: 'robusta' as const, units: 30, minQuality: 80, price: 60 }
    const state = {
      ...createState(5),
      orders: {
        open: [
          { ...order, deadlineDay: 12 },
          { ...order, id: 1, variety: 'arabicaStandard' as const, deadlineDay: 15 },
        ],
        nextId: 2,
      },
    }
    expect(deserialize(serialize(state))).toEqual(state)
  })

  it('rejects bad order values', () => {
    const order = {
      id: 0,
      variety: 'robusta',
      units: 30,
      minQuality: 80,
      price: 60,
      deadlineDay: 9,
    }
    const save = (change: object, nextId = 1) =>
      JSON.stringify({
        version: SAVE_VERSION,
        state: { ...createState(5), orders: { open: [{ ...order, ...change }], nextId } },
      })
    expect(deserialize(save({})).orders.open).toHaveLength(1)
    expect(() => deserialize(save({ units: -5 }))).toThrow(/orders\.open\.0\.units/)
    expect(() => deserialize(save({ units: 0 }))).toThrow(/orders\.open\.0\.units/)
    expect(() => deserialize(save({ id: -1 }))).toThrow(/orders\.open\.0\.id/)
    expect(() => deserialize(save({ price: -1 }))).toThrow(/orders\.open\.0\.price/)
    expect(() => deserialize(save({ minQuality: 80.5 }))).toThrow(/orders\.open\.0\.minQuality/)
    expect(() => deserialize(save({}, -1))).toThrow(/orders\.nextId/)
  })

  it('AC-4: loads a version 6 save with no orders', () => {
    expect(SAVE_VERSION).toBe(7)
    const old: Record<string, unknown> = { ...createState(5) }
    delete old.orders
    const loaded = deserialize(JSON.stringify({ version: 6, state: old }))
    expect(loaded.orders).toEqual({ open: [], nextId: 0 })
    expect(loaded).toEqual(createState(5))
  })
})
