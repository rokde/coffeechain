import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { quoteCare } from './care'
import { createState, type GameState } from '../state'
import { soilClassOf } from '../world/generate'
import type { Parcel, World } from '../world/types'
import type { Variety } from './yield'

const size = 4
type Care = 'Fertilize' | 'Irrigate'

function testWorld(): World {
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const soil = { fertility: 50, waterRetention: 50, soilQuality: 0.5 }
      parcels.push({ x, y, height: 0.2, zone: 'tiefland', ...soil, soilClass: 'gut' })
    }
  }
  return { seed: 0, size, parcels, start: { x: 1, y: 1 } }
}

// Owns (0,0), (1,0), (2,0) and (3,0). Robusta on (0,0), Arabica Standard on (1,0), (3,0) is empty.
function testState(money = 50000): GameState {
  const state = createState(1)
  return {
    ...state,
    world: testWorld(),
    money,
    time: { ...state.time, hour: 5 },
    farm: {
      ...state.farm,
      parcels: { 0: 0, 1: 0, 2: 0, 3: 0 },
      fields: [{ id: 0, name: 'A' }],
      plants: {
        0: { variety: 'robusta', plantedHour: 5 },
        1: { variety: 'arabicaStandard', plantedHour: 5 },
        2: { variety: 'robusta', plantedHour: 5 },
      },
    },
  }
}

const care = (state: GameState, type: Care, ...parcels: [number, number][]) =>
  dispatch(state, { type, parcels: parcels.map(([x, y]) => ({ x, y })) })

describe('Fertilize', () => {
  it('AC-1: takes careCost.fertilizer per plant and sets fertilized', () => {
    const state = testState()
    const before = structuredClone(state)
    const next = care(state, 'Fertilize', [0, 0], [1, 0])
    expect(next.money).toBe(50000 - 100 - 200)
    expect(next.farm.plants[0]).toEqual({ variety: 'robusta', plantedHour: 5, fertilized: true })
    expect(next.farm.plants[1]).toEqual({
      variety: 'arabicaStandard',
      plantedHour: 5,
      fertilized: true,
    })
    expect(next.farm.plants[2]).toEqual(state.farm.plants[2])
    expect(state).toEqual(before)
  })

  it('AC-2: raises fertility and updates soilQuality and soilClass', () => {
    const gain = balance().soil.fertilityGainPerFertilize
    const next = care(testState(), 'Fertilize', [0, 0])
    const parcel = next.world.parcels[0]!
    expect(parcel.fertility).toBe(50 + gain)
    expect(parcel.soilQuality).toBe((50 + gain + 50) / 200)
    expect(parcel.soilClass).toBe(soilClassOf(parcel.soilQuality, balance().soil.classMinQuality))
    expect(next.world.parcels[1]!.fertility).toBe(50)
  })

  it('AC-2: caps fertility at 100', () => {
    const state = testState()
    state.world.parcels[0] = { ...state.world.parcels[0]!, fertility: 99, waterRetention: 100 }
    const parcel = care(state, 'Fertilize', [0, 0]).world.parcels[0]!
    expect(parcel.fertility).toBe(100)
    expect(parcel.soilQuality).toBe(1)
    expect(parcel.soilClass).toBe('sehrGut')
  })

  it('AC-2: lowers the soil class back to the generateWorld rule', () => {
    const state = testState()
    // A stale class: the rule gives 'karg' for quality 0.1.
    state.world.parcels[0] = {
      ...state.world.parcels[0]!,
      fertility: 0,
      waterRetention: 14,
      soilClass: 'gut',
    }
    const parcel = care(state, 'Fertilize', [0, 0]).world.parcels[0]!
    expect(parcel.soilClass).toBe(soilClassOf(parcel.soilQuality, balance().soil.classMinQuality))
  })
})

describe.each<[Care, 'irrigated']>([['Irrigate', 'irrigated']])('%s', (type, flag) => {
  it(`AC-3: takes the care cost, sets ${flag} and keeps the fertility`, () => {
    const state = testState()
    const next = care(state, type, [0, 0], [1, 0])
    expect(next.money).toBe(50000 - 100 - 200)
    expect(next.farm.plants[0]).toEqual({ variety: 'robusta', plantedHour: 5, [flag]: true })
    expect(next.farm.plants[1]![flag]).toBe(true)
    expect(next.world).toEqual(state.world)
  })
})

describe('care once per cycle', () => {
  it('AC-4: rejects the same care twice, accepts a different care', () => {
    for (const type of ['Fertilize', 'Irrigate'] as const) {
      const once = care(testState(), type, [0, 0])
      expect(() => care(once, type, [0, 0])).toThrow()
    }
    let state = care(testState(), 'Fertilize', [0, 0])
    state = care(state, 'Irrigate', [0, 0])
    expect(state.farm.plants[0]).toEqual({
      variety: 'robusta',
      plantedHour: 5,
      fertilized: true,
      irrigated: true,
    })
  })

  it('AC-4: a new plant has no care flags', () => {
    const state = care(testState(), 'Fertilize', [0, 0])
    const next = dispatch(state, { type: 'Plant', variety: 'robusta', parcels: [{ x: 3, y: 0 }] })
    expect(next.farm.plants[3]).toEqual({ variety: 'robusta', plantedHour: 5 })
    expect(care(next, 'Fertilize', [3, 0]).farm.plants[3]!.fertilized).toBe(true)
  })
})

describe('rejected care', () => {
  const ripe = (variety: Variety) => {
    const state = testState()
    const days = balance().varieties[variety].cycleDays
    return { ...state, time: { ...state.time, hour: 5 + days * balance().time.ticksPerGameDay } }
  }

  it('AC-5: Robusta is ripe 3 game days after planting', () => {
    expect(balance().varieties.robusta.cycleDays).toBe(3)
  })

  it.each<[string, GameState, [number, number][]]>([
    [
      'a parcel outside the map',
      testState(),
      [
        [0, 0],
        [4, 0],
      ],
    ],
    [
      'a parcel that is not owned',
      testState(),
      [
        [0, 0],
        [3, 3],
      ],
    ],
    [
      'a parcel with no plant',
      testState(),
      [
        [0, 0],
        [3, 0],
      ],
    ],
    ['a ripe plant', ripe('robusta'), [[0, 0]]],
    [
      'a duplicate parcel',
      testState(),
      [
        [0, 0],
        [1, 0],
        [0, 0],
      ],
    ],
    [
      'a total cost above the money',
      testState(299),
      [
        [0, 0],
        [1, 0],
      ],
    ],
  ])('AC-5: rejects %s and changes nothing', (_, state, parcels) => {
    for (const type of ['Fertilize', 'Irrigate'] as const) {
      const before = structuredClone(state)
      expect(() => care(state, type, ...parcels)).toThrow()
      expect(state).toEqual(before)
    }
  })

  it('AC-5: accepts a plant one hour before ripeness and a cost equal to the money', () => {
    const state = ripe('robusta')
    const almost = { ...state, money: 100, time: { ...state.time, hour: state.time.hour - 1 } }
    expect(care(almost, 'Fertilize', [0, 0]).money).toBe(0)
  })
})

describe('quoteCare (S18a)', () => {
  it('sums careCost per plant in hundredths of CC and skips parcels without a plant', () => {
    const parcels = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ]
    for (const type of ['Fertilize', 'Irrigate'] as const)
      expect(quoteCare(testState(), { type, parcels })).toBe(100 + 200)
  })
})
