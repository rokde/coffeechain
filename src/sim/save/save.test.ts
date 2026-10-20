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
    const text = JSON.stringify({ version: 1, state: { a: 1 } })
    const m1 = (s: Record<string, unknown>) => ({ ...s, b: 2 })
    const m2 = (s: Record<string, unknown>) => ({ ...s, c: s.b })
    expect(deserialize(text, { version: 3, migrations: [m1, m2] })).toEqual({ a: 1, b: 2, c: 2 })
    const v2 = JSON.stringify({ version: 2, state: { a: 1, b: 5 } })
    expect(deserialize(v2, { version: 3, migrations: [m1, m2] })).toEqual({ a: 1, b: 5, c: 5 })
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
