import { describe, expect, it } from 'vitest'
import raw from '../../../config/balance.json'
import questions from '../../../docs/open-questions.md?raw'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import { generateWorld } from '../world/generate'
import type { Parcel, World, Zone } from '../world/types'

const size = 6

// Flat lowland. (0,0) is water, (4,4) is highland, (5,0) is a peak, so it and its neighbours are steep.
function testWorld(): World {
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const zone: Zone =
        x === 0 && y === 0 ? 'wasser' : x === 4 && y === 4 ? 'hochland' : 'tiefland'
      const height = x === 5 && y === 0 ? 0.9 : 0.2
      const soil = { fertility: 50, waterRetention: 50, soilQuality: 0.5 }
      parcels.push({ x, y, height, zone, ...soil, soilClass: 'gut' })
    }
  }
  return { seed: 0, size, parcels, start: { x: 2, y: 2 } }
}

const testState = (money = 50000): GameState => ({ ...createState(1), world: testWorld(), money })

const buy = (state: GameState, ...parcels: [number, number][]) =>
  dispatch(state, { type: 'CreateParcels', parcels: parcels.map(([x, y]) => ({ x, y })) })

const fieldOf = (state: GameState, x: number, y: number) => {
  const id = state.farm.parcels[y * size + x]
  return state.farm.fields.find((f) => f.id === id)?.name
}

describe('createState', () => {
  it('AC-1: starts with 500 CC and the world of the seed', () => {
    const state = createState(42)
    expect(state.money).toBe(50000)
    expect(state.world).toEqual(generateWorld(42, balance()))
    expect(state.farm).toEqual({ parcels: {}, fields: [], nextFieldId: 0, plants: {} })
  })
})

describe('CreateParcels cost', () => {
  it('AC-2: takes 48 CC for the first lowland parcel and 100 CC for the next', () => {
    const both = buy(testState(), [1, 2], [2, 2])
    expect(both.money).toBe(50000 - 4800 - 10000)

    const first = buy(testState(), [1, 2])
    expect(first.money).toBe(50000 - 4800)
    const second = buy(first, [2, 2])
    expect(second.money).toBe(50000 - 14800)
    expect(second.farm).toEqual(both.farm)
  })

  it('AC-2: takes 150 CC for a highland parcel after the first parcel', () => {
    const first = buy(testState(), [1, 2])
    expect(buy(first, [4, 4]).money).toBe(first.money - 15000)
  })
})

describe('CreateParcels rejects', () => {
  const owned = buy(testState(), [3, 3])
  it.each<[string, GameState, [number, number][]]>([
    [
      'a water parcel',
      testState(),
      [
        [1, 1],
        [0, 0],
      ],
    ],
    [
      'a steep parcel',
      testState(),
      [
        [1, 1],
        [5, 0],
      ],
    ],
    [
      'a neighbour of a steep parcel',
      testState(),
      [
        [1, 1],
        [4, 0],
      ],
    ],
    [
      'an owned parcel',
      owned,
      [
        [1, 1],
        [3, 3],
      ],
    ],
    [
      'a duplicate in the list',
      testState(),
      [
        [1, 1],
        [2, 1],
        [1, 1],
      ],
    ],
    [
      'a parcel outside the map',
      testState(),
      [
        [1, 1],
        [6, 1],
      ],
    ],
    [
      'a negative position',
      testState(),
      [
        [1, 1],
        [-1, 1],
      ],
    ],
    [
      'a position that is not an integer',
      testState(),
      [
        [1, 1],
        [1.5, 1],
      ],
    ],
    [
      'a total cost above the balance',
      testState(14799),
      [
        [1, 1],
        [2, 1],
      ],
    ],
  ])('AC-3: %s and buys nothing', (_, state, parcels) => {
    const before = structuredClone(state)
    expect(() => buy(state, ...parcels)).toThrow()
    expect(state).toEqual(before)
  })

  it('AC-3: accepts a total cost equal to the balance', () => {
    expect(buy(testState(14800), [1, 1], [2, 1]).money).toBe(0)
  })
})

describe('CreateParcels fields', () => {
  it('AC-4: groups neighbours, starts new fields and merges into the lowest id', () => {
    let state = buy(testState(), [1, 2], [2, 2])
    expect(fieldOf(state, 1, 2)).toBe('A')
    expect(fieldOf(state, 2, 2)).toBe('A')

    state = buy(state, [4, 2])
    expect(fieldOf(state, 4, 2)).toBe('B')

    state = buy(state, [3, 2])
    for (const x of [1, 2, 3, 4]) expect(fieldOf(state, x, 2)).toBe('A')
    expect(state.farm.fields).toEqual([{ id: 0, name: 'A' }])

    // A name is never used again.
    state = buy(state, [1, 4])
    expect(fieldOf(state, 1, 4)).toBe('C')
  })

  it('AC-4: a diagonal neighbour starts a new field', () => {
    const state = buy(testState(), [1, 1], [2, 2])
    expect(fieldOf(state, 1, 1)).toBe('A')
    expect(fieldOf(state, 2, 2)).toBe('B')
  })
})

describe('balance config', () => {
  it('AC-5: has parcels.maxSlope as a NEU value in the config and the open questions', () => {
    expect(raw.parcels.maxSlope.src).toBe('NEU')
    expect(balance().parcels.maxSlope).toBe(raw.parcels.maxSlope.v)
    expect(questions).toContain('`parcels.maxSlope`')
  })
})
