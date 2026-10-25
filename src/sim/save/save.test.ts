import { describe, expect, it } from 'vitest'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import { calendar, step } from '../time/time'
import { growth } from '../farm/plants'
import type { Parcel } from '../world/types'
import { deserialize, MIGRATIONS, SAVE_VERSION, serialize } from './save'

// The old migrations stay, but the default format rejects saves below version 11 (#17).
const legacy = { version: SAVE_VERSION, minVersion: 1, migrations: MIGRATIONS }
const loadOld = (text: string) => deserialize(text, legacy)

// The shape of a state before version 12: game hours (24 per old day) instead of calendar days.
// It covers the fields of the states in this file.
function v11(state: GameState): Record<string, unknown> {
  const { day, stage, ...time } = state.time
  expect(stage).toBe('months')
  const plants = Object.fromEntries(
    Object.entries(state.farm.plants).map(([k, { plantedDay, ...plant }]) => [
      k,
      { ...plant, plantedHour: (plantedDay * 24) / 30 },
    ]),
  )
  // Old day numbers start at 1.
  const volumes = state.market.volumes.map((v) => ({ ...v, day: v.day / 30 + 1 }))
  return {
    ...state,
    time: { ...time, hour: (day * 24) / 30 },
    farm: { ...state.farm, plants },
    market: { ...state.market, volumes },
  }
}

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
  for (let day = 0; day < days; day++) {
    state = step(state)
    const ripe = [0, 1]
      .filter((x) => {
        const plant = state.farm.plants[x]
        return plant && growth(plant, state.time.day).progress >= 1
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
    const state = runDays(populated(), 120)
    expect(state.storage.batches.length + state.market.volumes.length).toBeGreaterThan(0)
    expect(deserialize(serialize(state))).toEqual(state)
  })

  it('AC-2: save, load and 150 more days equal 150 days without a break', () => {
    const a = populated()
    const direct = runDays(a, 150)
    const loaded = runDays(deserialize(serialize(a)), 150)
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
    expect(() => deserialize(JSON.stringify({ version: SAVE_VERSION }))).toThrow(/state/)
    expect(() => deserialize(JSON.stringify({ version: SAVE_VERSION, state: 3 }))).toThrow(/state/)
    expect(() => deserialize('[]')).toThrow(/state/)
  })

  it('AC-5: runs migrations in order', () => {
    // The migrations set the money of a valid state from the fields a and b.
    const state = createState(1)
    const text = JSON.stringify({ version: 1, state: { ...state, a: 1 } })
    const m1 = (s: Record<string, unknown>) => ({ ...s, b: 2 })
    const m2 = (s: Record<string, unknown>) => ({
      ...s,
      money: Number(s.a) * 1000 + Number(s.b) * 100,
    })
    const format = { version: 3, minVersion: 1, migrations: [m1, m2] }
    expect(deserialize(text, format).money).toBe(1200)
    const v2 = JSON.stringify({ version: 2, state: { ...state, a: 1, b: 5 } })
    expect(deserialize(v2, format).money).toBe(1500)
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

    it('AC-1: checks the milestones', () => {
      expect(() => deserialize(save((s) => (s.milestones = { harvested: '1' })))).toThrow(
        /milestones\.harvested/,
      )
    })

    it('AC-1: checks nested fields and unknown varieties', () => {
      const plant = (variety: unknown) =>
        save((s) => {
          ;(s.farm as { plants: Record<number, unknown> }).plants[0] = { variety, plantedDay: 0 }
        })
      expect(deserialize(plant('robusta')).farm.plants[0]?.variety).toBe('robusta')
      expect(() => deserialize(plant('tea'))).toThrow(/farm\.plants\.0\.variety/)
    })
  })

  it('loads a version 1 save with the events and milestones defaults', () => {
    const old = v11(createState(1))
    delete old.events
    delete old.milestones
    const loaded = loadOld(JSON.stringify({ version: 1, state: old }))
    expect(loaded.milestones).toEqual({ harvested: 0 })
    expect(loaded).toEqual(createState(1))
  })

  it('loads a version 2 save with the milestones default', () => {
    const old = v11(createState(1))
    delete old.milestones
    const loaded = loadOld(JSON.stringify({ version: 2, state: old }))
    expect(loaded).toEqual(createState(1))
  })
})

describe('events migration', () => {
  it('loads a version 1 save without an event list', () => {
    const old = v11(createState(5))
    delete old.milestones
    const loaded = loadOld(JSON.stringify({ version: 1, state: old }))
    expect(loaded).toEqual(createState(5))
  })
})

describe('research migration', () => {
  it('loads a version 3 save without a research list', () => {
    const loaded = loadOld(JSON.stringify({ version: 3, state: v11(createState(5)) }))
    expect(loaded).toEqual(createState(5))
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
          { variety: 'robusta', units: 7, quality: 80, washed: true, readyDay: 24 },
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
      state: {
        ...v11(base),
        storage: { batches: [{ variety: 'robusta', units: 3, quality: 80 }] },
      },
    })
    const raw = { variety: 'robusta', units: 3, quality: 80, readyDay: 24 }
    const bad = serialize({ ...base, storage: { batches: [raw as never] } })
    expect(() => deserialize(bad)).toThrow(/readyDay needs washed/)
    expect(loadOld(old).storage.batches).toEqual([{ variety: 'robusta', units: 3, quality: 80 }])
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
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(7)
    const old = v11(createState(5))
    delete old.orders
    const loaded = loadOld(JSON.stringify({ version: 6, state: old }))
    expect(loaded.orders).toEqual({ open: [], nextId: 0 })
    expect(loaded).toEqual(createState(5))
  })
})

describe('whole CC migration (S57)', () => {
  const load = (version: number, money: number, invested: number) =>
    loadOld(JSON.stringify({ version, state: { ...v11(createState(5)), money, invested } }))

  it('AC-4: floors money and invested of a version 7 save to whole CC', () => {
    expect(load(7, 12345, 4599)).toMatchObject({ money: 12300, invested: 4500 })
    expect(load(7, -50, 0).money).toBe(-100)
  })

  it('AC-4: loads a version 8 save unchanged', () => {
    const state = { ...createState(5), money: 12300, invested: 4500 }
    expect(deserialize(serialize(state))).toEqual(state)
  })

  it('Round 1: floors a version 8 save with fractions and does not reject it', () => {
    expect(load(8, 15050.5, 4599)).toMatchObject({ money: 15000, invested: 4500 })
  })

  it('AC-4: still rejects a version 7 save with a bad money value', () => {
    const old = JSON.stringify({ version: 7, state: { ...v11(createState(5)), money: 'x' } })
    expect(() => loadOld(old)).toThrow(/money/)
  })
})

describe('remove events migration (#8)', () => {
  // A version 8 save of populated() with an active and a warned event, research and a growth delay.
  function oldSave(): string {
    const state = v11(populated()) as unknown as GameState
    const plants = { ...state.farm.plants, 0: { ...state.farm.plants[0]!, growthDelayHours: 5.5 } }
    const old = {
      ...state,
      farm: { ...state.farm, plants },
      events: [
        { type: 'monsoon', announcedDay: 0, startDay: 1, endDay: 7 },
        { type: 'frost', announcedDay: 1, startDay: 3, endDay: 5 },
      ],
      research: [12],
    }
    return JSON.stringify({ version: 8, state: old })
  }

  it('AC-4: has version 9 and drops events, research and growthDelayHours of a version 8 save', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(9)
    const loaded = loadOld(oldSave())
    expect(loaded).not.toHaveProperty('events')
    expect(loaded).not.toHaveProperty('research')
    for (const plant of Object.values(loaded.farm.plants))
      expect(plant).not.toHaveProperty('growthDelayHours')
    expect(loaded).toEqual(populated())
  })

  it('AC-4: save, load and 150 more days of a version 8 save equal 150 days without a break', () => {
    const loaded = loadOld(oldSave())
    expect(runDays(deserialize(serialize(loaded)), 150)).toEqual(runDays(populated(), 150))
  })
})

describe('remove pest protection migration (#8)', () => {
  it('AC-4: has version 10 and drops pestProtected of a version 9 save', () => {
    expect(SAVE_VERSION).toBeGreaterThanOrEqual(10)
    const state = populated()
    const cared = { ...state.farm.plants[0]!, fertilized: true, irrigated: true }
    const old = v11({ ...state, farm: { ...state.farm, plants: { 0: cared } } })
    const farm = old.farm as GameState['farm']
    farm.plants[0] = { ...farm.plants[0]!, pestProtected: true } as never
    const loaded = loadOld(JSON.stringify({ version: 9, state: old }))
    expect(loaded.farm.plants[0]).not.toHaveProperty('pestProtected')
    expect(loaded.farm.plants[0]).toEqual(cared)
  })
})

describe('remove volcano zone (#17)', () => {
  it('AC-3: rejects a save below version 11 with "unknown or old version"', () => {
    expect(SAVE_VERSION).toBe(12)
    for (const version of [1, 9, 10]) {
      const text = JSON.stringify({ version, state: createState(5) })
      expect(() => deserialize(text)).toThrow('unknown or old version')
    }
  })

  it('AC-3: loads a save with version 11', () => {
    const state = createState(5)
    expect(deserialize(JSON.stringify({ version: 11, state: v11(state) }))).toEqual(state)
  })

  it('AC-3: rejects a version 11 save with a vulkan parcel', () => {
    const state = structuredClone(createState(5))
    ;(state.world.parcels[0] as { zone: string }).zone = 'vulkan'
    expect(() => deserialize(serialize(state))).toThrow(/world\.parcels\.0\.zone/)
  })
})

describe('calendar migration (#27)', () => {
  it('AC-4: loads a version 11 save with game hours as version 12 calendar days', () => {
    const base = createState(5)
    const order = { id: 0, variety: 'robusta', units: 30, minQuality: 80, price: 60 }
    const old = {
      ...base,
      time: { hour: 48, speed: 2 },
      farm: {
        ...base.farm,
        parcels: { 0: 0 },
        plants: { 0: { variety: 'robusta', plantedHour: 0 } },
      },
      storage: {
        batches: [
          { variety: 'robusta', units: 3, quality: 80 },
          { variety: 'robusta', units: 7, quality: 80, washed: true, readyHour: 60 },
        ],
      },
      market: {
        ...base.market,
        volumes: [{ kind: 'coffee', variety: 'robusta', day: 2, units: 5 }],
      },
      orders: { open: [{ ...order, deadlineDay: 6 }], nextId: 1 },
      milestones: { harvested: 1000, harvestProHour: 25 },
    }
    expect(SAVE_VERSION).toBe(12)
    const loaded = deserialize(JSON.stringify({ version: 11, state: old }))
    expect(loaded.time).toEqual({ day: 60, speed: 2, stage: 'months' })
    expect(calendar(loaded.time.day)).toEqual({ dayOfMonth: 1, month: 3, year: 1 })
    expect(loaded.farm.plants[0]).toEqual({ variety: 'robusta', plantedDay: 0 })
    expect(loaded.storage.batches[0]).toEqual({ variety: 'robusta', units: 3, quality: 80 })
    expect(loaded.storage.batches[1]!.readyDay).toBe(75)
    expect(loaded.orders.open[0]!.deadlineDay).toBe(150)
    expect(loaded.market.volumes[0]!.day).toBe(30)
    expect(loaded.milestones.harvestProDay).toBe(31)
    expect(JSON.stringify(loaded)).not.toMatch(/Hour|"hour"/)
    // deserialize ran the schema check, so a round trip gives the same state.
    expect(deserialize(serialize(loaded))).toEqual(loaded)
  })

  it('AC-4: rejects a version 12 save without a stage', () => {
    const state = structuredClone(createState(5)) as unknown as { time: Record<string, unknown> }
    delete state.time.stage
    expect(() => deserialize(JSON.stringify({ version: 12, state }))).toThrow(/time\.stage/)
  })

  it('AC-5 (085): round-trips the weeks stage, and a version 12 save without weeksFromDay loads', () => {
    const base = createState(5)
    const weeks: GameState = { ...base, time: { ...base.time, stage: 'weeks', weeksFromDay: 400 } }
    expect(deserialize(serialize(weeks)).time).toEqual({
      day: 0,
      speed: 1,
      stage: 'weeks',
      weeksFromDay: 400,
    })
    expect(SAVE_VERSION).toBe(12)
    const old = JSON.stringify({ version: 12, state: base })
    expect(deserialize(old).time).toEqual({ day: 0, speed: 1, stage: 'months' })
  })
})
