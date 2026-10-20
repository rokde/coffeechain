import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { isFree } from '../farm/parcels'
import { phase } from '../progression/capital'
import { deserialize, serialize } from '../save/save'
import { createState, type GameState } from '../state'
import { nextStorageCapacity, storageCapacity } from './capacity'

// Owns 2 empty lowland parcels and has enough money.
function setup() {
  const base = createState(42)
  const [a, b] = base.world.parcels
    .filter((p) => p.zone === 'tiefland' && isFree(base, p.x, p.y))
    .slice(0, 2)
    .map(({ x, y }) => ({ x, y }))
  const state = dispatch(
    { ...base, money: 1_000_000 },
    { type: 'CreateParcels', parcels: [a!, b!] },
  )
  return { state, a: a!, b: b! }
}

const index = (state: GameState, p: { x: number; y: number }) => p.y * state.world.size + p.x

describe('storageCapacity (S45)', () => {
  it('AC-1: gives the start capacity, then the capacity of each stage', () => {
    const { startCapacity, upgrades } = balance().storage
    const { state, a, b } = setup()
    expect(storageCapacity(state)).toBe(startCapacity)
    expect(nextStorageCapacity(state)).toBe(upgrades[0]!.capacity)
    const one = dispatch(state, { type: 'Build', building: 'storage', parcel: a })
    expect(storageCapacity(one)).toBe(upgrades[0]!.capacity)
    expect(nextStorageCapacity(one)).toBe(upgrades[1]!.capacity)
    // The second stage needs phase 2, so the test adds the building directly.
    const two = {
      ...one,
      buildings: { ...one.buildings, [index(one, b)]: { kind: 'storage' as const } },
    }
    expect(storageCapacity(two)).toBe(upgrades[1]!.capacity)
    expect(nextStorageCapacity(two)).toBeNull()
    expect([startCapacity, upgrades[0]!.capacity, upgrades[1]!.capacity]).toEqual([100, 250, 600])
  })

  it('AC-1: ignores other buildings', () => {
    const { state, a } = setup()
    const next = dispatch(state, { type: 'Build', building: 'processing', parcel: a })
    expect(storageCapacity(next)).toBe(balance().storage.startCapacity)
  })

  it('AC-3: Build charges the stage cost, keeps the phase lock and survives a save', () => {
    const { state: rich, a, b } = setup()
    const state = { ...rich, money: 100_000 }
    expect(phase(state)).toBe(1)
    const one = dispatch(state, { type: 'Build', building: 'storage', parcel: a })
    expect(one.money).toBe(state.money - 15_000)
    expect(one.invested).toBe(state.invested + 15_000)
    const before = structuredClone(one)
    expect(() => dispatch(one, { type: 'Build', building: 'storage', parcel: b })).toThrow(
      /phase 2/,
    )
    expect(one).toEqual(before)
    expect(storageCapacity(deserialize(serialize(one)))).toBe(250)
  })
})
