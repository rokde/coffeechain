import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { isFree } from '../farm/parcels'
import { deserialize, MIGRATIONS, SAVE_VERSION, serialize } from '../save/save'
import { createState, type GameState } from '../state'
import { buildMenu, type Build } from './build'

type Pos = { x: number; y: number }

// Owns 4 lowland parcels and plants Robusta on the last one. The other three are empty.
function setup() {
  const base = createState(42)
  const lands = base.world.parcels
    .filter((p) => p.zone === 'tiefland' && isFree(base, p.x, p.y))
    .slice(0, 5)
    .map(({ x, y }) => ({ x, y }))
  const [a, b, c, planted, free] = lands as [Pos, Pos, Pos, Pos, Pos]
  let state = dispatch(
    { ...base, money: 1_000_000 },
    { type: 'CreateParcels', parcels: [a, b, c, planted] },
  )
  state = dispatch(state, { type: 'Plant', variety: 'robusta', parcels: [planted] })
  return { state: { ...state, money: 100_000 }, a, b, c, planted, free }
}

const index = (state: GameState, p: Pos) => p.y * state.world.size + p.x
const build = (state: GameState, building: Build['building'], parcel: Pos) =>
  dispatch(state, { type: 'Build', building, parcel })

describe('Build (S44)', () => {
  it('AC-1: puts the Aufbereitung on the parcel, charges its cost and survives a save', () => {
    const { state, a } = setup()
    const next = build(state, 'processing', a)
    expect(next.buildings[index(state, a)]).toEqual({ kind: 'processing' })
    expect(next.money).toBe(state.money - balance().processing.washed.buildCost * 100)
    expect(deserialize(serialize(next, 0))).toEqual(next)
  })

  it('AC-2: throws on a bad parcel and leaves the state unchanged', () => {
    const { state, a, planted, free } = setup()
    const before = structuredClone(state)
    const built = build(state, 'storage', a)
    const size = state.world.size
    for (const parcel of [{ x: -1, y: 0 }, { x: size, y: 0 }, { x: 0.5, y: 0 }, free, planted]) {
      expect(() => build(state, 'processing', parcel)).toThrow()
    }
    expect(() => build(built, 'processing', a)).toThrow(/building/)
    expect(state).toEqual(before)
  })

  it('AC-2: throws when money is short, the entry is locked, or the maximum is reached', () => {
    const { state, a, b, c } = setup()
    expect(() => build({ ...state, money: 14_999 }, 'processing', a)).toThrow(/money/)
    const one = build(state, 'processing', a)
    expect(() => build(one, 'processing', b)).toThrow(/maximum/)
    const store = build(state, 'storage', a)
    expect(() => build(store, 'storage', b)).toThrow(/phase 2/)
    // The full list of stages, with the lock out of the way.
    const full = {
      ...store,
      buildings: { ...store.buildings, [index(state, b)]: { kind: 'storage' as const } },
    }
    expect(() => build(full, 'storage', c)).toThrow(/maximum/)
    expect(balance().storage.upgrades.length).toBe(2)
  })

  it('AC-2: Plant throws on a parcel with a building', () => {
    const { state, a } = setup()
    const next = build(state, 'processing', a)
    expect(() => dispatch(next, { type: 'Plant', variety: 'robusta', parcels: [a] })).toThrow(
      /building/,
    )
  })

  it('AC-3: lists both buildings with cost, lock and availability', () => {
    const { state, a, b } = setup()
    expect(buildMenu(createState(1))).toEqual([
      { kind: 'processing', cost: 15_000, locked: false, requiredPhase: 1, available: true },
      { kind: 'storage', cost: 15_000, locked: false, requiredPhase: 1, available: true },
    ])
    const store = build(state, 'storage', a)
    expect(buildMenu(store)[1]).toEqual({
      kind: 'storage',
      cost: 40_000,
      locked: true,
      requiredPhase: 2,
      available: true,
    })
    expect(buildMenu(build(store, 'processing', b))[0]!.available).toBe(false)
  })

  it('loads a version 4 save with no buildings', () => {
    const old: Record<string, unknown> = { ...createState(5) }
    delete old.buildings
    old.time = { hour: 0, speed: 1 } // The time shape before #27.
    const loaded = deserialize(JSON.stringify({ version: 4, state: old }), {
      version: SAVE_VERSION,
      minVersion: 1,
      migrations: MIGRATIONS,
    })
    expect(loaded.buildings).toEqual({})
    expect(loaded).toEqual(createState(5))
  })
})
