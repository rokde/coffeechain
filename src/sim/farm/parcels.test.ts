import { describe, expect, it } from 'vitest'
import raw from '../../../config/balance.json'
import questions from '../../../docs/open-questions.md?raw'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import { generateWorld } from '../world/generate'
import { placeProps } from '../world/props'
import type { Parcel, World, Zone } from '../world/types'
import { isBuildable, quoteParcels } from './parcels'

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

// Trees at (3,3), (1,4) and (4,2). The test world has no poor soil, so placeProps sets no trees.
const testState = (money = 50000): GameState => ({
  ...createState(1),
  world: testWorld(),
  props: {
    ...placeProps(testWorld(), balance()),
    trees: [
      { x: 3, y: 3 },
      { x: 1, y: 4 },
      { x: 4, y: 2 },
    ],
  },
  money,
})

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

describe('quoteParcels (S12)', () => {
  const pos = (...list: [number, number][]) => list.map(([x, y]) => ({ x, y }))
  const owned = buy(testState(), [3, 3])
  it.each<[string, GameState, [number, number][], number]>([
    ['one lowland parcel, none owned', testState(), [[1, 2]], 4800],
    [
      'two lowland parcels, none owned',
      testState(),
      [
        [1, 2],
        [2, 2],
      ],
      14800,
    ],
    ['one lowland parcel, one owned', owned, [[1, 2]], 10000],
    ['one highland parcel, one owned', owned, [[4, 4]], 15000],
  ])('AC-1: %s gives %i, and CreateParcels takes the same', (_, state, list, cost) => {
    expect(quoteParcels(state, pos(...list))).toBe(cost)
    expect(state.money - buy(state, ...list).money).toBe(cost)
  })

  it('AC-1: gives 0 for an empty list', () => {
    expect(quoteParcels(testState(), [])).toBe(0)
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

describe('CreateParcels trees', () => {
  it('AC-2: removes the tree on a bought parcel', () => {
    const state = buy(testState(), [3, 3])
    expect(state.props.trees).not.toContainEqual({ x: 3, y: 3 })
  })

  it('AC-3: keeps the other trees in order and the hut, market and path', () => {
    const before = testState()
    const after = buy(before, [3, 3])
    expect(after.props).toEqual({
      ...before.props,
      trees: [
        { x: 1, y: 4 },
        { x: 4, y: 2 },
      ],
    })
  })

  it.each<[string, GameState, [number, number][]]>([
    [
      'water',
      testState(),
      [
        [3, 3],
        [0, 0],
      ],
    ],
    [
      'too steep',
      testState(),
      [
        [3, 3],
        [5, 0],
      ],
    ],
    ['not enough money', testState(100), [[3, 3]]],
    [
      'already owned',
      buy(testState(), [2, 2]),
      [
        [3, 3],
        [2, 2],
      ],
    ],
  ])('AC-4: keeps all trees when the command throws (%s)', (_, state, parcels) => {
    expect(() => buy(state, ...parcels)).toThrow()
    expect(state.props.trees).toHaveLength(3)
    expect(state.props.trees).toContainEqual({ x: 3, y: 3 })
  })
})

describe('balance config', () => {
  it('AC-5: has parcels.maxSlope as a NEU value in the config and the open questions', () => {
    expect(raw.parcels.maxSlope.src).toBe('NEU')
    expect(balance().parcels.maxSlope).toBe(raw.parcels.maxSlope.v)
    expect(questions).toContain('`parcels.maxSlope`')
  })
})

describe('isBuildable (S8)', () => {
  const world = testWorld()

  it('AC-3: is false for water and for steep parcels, true for all others', () => {
    const blocked = ['0,0', '5,0', '4,0', '5,1']
    for (const { x, y } of world.parcels) {
      expect(isBuildable(world, x, y), `${x},${y}`).toBe(!blocked.includes(`${x},${y}`))
    }
  })

  it('AC-3: uses parcels.maxSlope as the limit', () => {
    const { maxSlope } = balance().parcels
    const edge = testWorld()
    edge.parcels[2 * size + 2]!.height = 0.2 + maxSlope
    expect(isBuildable(edge, 2, 2)).toBe(true)
    edge.parcels[2 * size + 2]!.height = 0.2 + maxSlope * 1.01
    expect(isBuildable(edge, 2, 2)).toBe(false)
  })

  it('AC-3: CreateParcels rejects exactly the parcels that are not buildable', () => {
    const state = { ...createState(42), money: 1e9 }
    for (const { x, y } of state.world.parcels) {
      const buy1 = () => buy(state, [x, y])
      if (isBuildable(state.world, x, y)) expect(buy1).not.toThrow()
      else expect(buy1).toThrow()
    }
  })
})
