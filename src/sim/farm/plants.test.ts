import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import { step } from '../time/time'
import type { Parcel, World } from '../world/types'
import { bankSellPrice } from '../market/market'
import { forecastYield } from './forecast'
import { growth, quotePlant } from './plants'
import { computeYield, type Variety } from './yield'

function testWorld(size = 4): World {
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const soil = { fertility: 50, waterRetention: 50, soilQuality: 0.5 }
      parcels.push({ x, y, height: 0.2, zone: 'tiefland', ...soil, soilClass: 'gut' })
    }
  }
  return { seed: 0, size, parcels, start: { x: 1, y: 1 } }
}

// Owns the parcels (0,0), (1,0) and (2,0) in field 0.
function testState(money = 50000): GameState {
  const state = createState(1)
  return {
    ...state,
    world: testWorld(),
    props: { hut: { x: 1, y: 1 }, market: { x: 1, y: 1 }, path: [{ x: 1, y: 1 }], trees: [] },
    money,
    time: { ...state.time, hour: 5 },
    farm: { ...state.farm, parcels: { 0: 0, 1: 0, 2: 0 }, fields: [{ id: 0, name: 'A' }] },
  }
}

const plant = (state: GameState, variety: Variety, ...parcels: [number, number][]) =>
  dispatch(state, { type: 'Plant', variety, parcels: parcels.map(([x, y]) => ({ x, y })) })

describe('Plant', () => {
  it('AC-1: takes about 2 CC per Robusta parcel and adds the plants', () => {
    const state = testState()
    const before = structuredClone(state)
    const next = plant(state, 'robusta', [0, 0], [1, 0])
    // 2 seeds at the mid volume of 1 unit: 2 × 2 × (1 + 0.3 × 1 / 200) = 4.006 CC → 5 CC (S57).
    expect(next.money).toBe(50000 - 500)
    expect(next.farm.plants).toEqual({
      0: { variety: 'robusta', plantedHour: 5 },
      1: { variety: 'robusta', plantedHour: 5 },
    })
    expect(next.farm.parcels).toEqual(state.farm.parcels)
    expect(state).toEqual(before)
  })

  const planted = plant(testState(), 'robusta', [2, 0])
  it.each<[string, GameState, Variety, [number, number][]]>([
    [
      'a parcel that is not owned',
      testState(),
      'robusta',
      [
        [0, 0],
        [3, 3],
      ],
    ],
    [
      'a parcel outside the map',
      testState(),
      'robusta',
      [
        [0, 0],
        [4, 0],
      ],
    ],
    [
      'a parcel that already has a plant',
      planted,
      'robusta',
      [
        [0, 0],
        [2, 0],
      ],
    ],
    [
      'a duplicate parcel',
      testState(),
      'robusta',
      [
        [0, 0],
        [1, 0],
        [0, 0],
      ],
    ],
    ['a locked variety', testState(), 'arabicaPremium', [[0, 0]]],
    [
      'a total cost above the money',
      testState(499),
      'robusta',
      [
        [0, 0],
        [1, 0],
      ],
    ],
  ])('AC-2: rejects %s and changes nothing', (_, state, variety, parcels) => {
    const before = structuredClone(state)
    expect(() => plant(state, variety, ...parcels)).toThrow()
    expect(state).toEqual(before)
  })

  it('AC-2: accepts a total cost equal to the money', () => {
    expect(plant(testState(500), 'robusta', [0, 0], [1, 0]).money).toBe(0)
  })

  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'AC-1 (S21b): rejects the inherited key %s as an unknown variety',
    (variety) => {
      const state = testState()
      const before = structuredClone(state)
      expect(() => plant(state, variety as Variety, [0, 0])).toThrow('Unknown variety')
      expect(state).toEqual(before)
    },
  )

  it('keeps the plants when more parcels are bought', () => {
    const state = plant(testState(), 'robusta', [0, 0])
    const next = dispatch(state, { type: 'CreateParcels', parcels: [{ x: 3, y: 0 }] })
    expect(next.farm.plants).toEqual(state.farm.plants)
  })
})

describe('growth with step', () => {
  it.each<[Variety, number]>([
    ['robusta', 72],
    ['arabicaStandard', 120],
  ])('AC-3: %s is ripe after exactly %i steps', (variety, steps) => {
    let state = plant({ ...testState(), time: { hour: 0, speed: 1 } }, variety, [0, 0])
    for (let i = 0; i < steps - 1; i++) state = step(state)
    expect(growth(state.farm.plants[0]!, state.time.hour).stage).not.toBe('reif')
    state = step(state)
    expect(growth(state.farm.plants[0]!, state.time.hour).stage).toBe('reif')
  })
})

describe('growth stages', () => {
  const robusta = { variety: 'robusta', plantedHour: 0 } as const

  it.each([
    [0, 'setzling'],
    [17, 'setzling'],
    [18, 'wachstum'],
    [43, 'wachstum'],
    [44, 'bluete'],
    [64, 'bluete'],
    [65, 'fruchtansatz'],
    [71, 'fruchtansatz'],
    [72, 'reif'],
    [1000, 'reif'],
  ])('AC-4: Robusta at hour %i is %s', (hour, stage) => {
    expect(growth(robusta, hour).stage).toBe(stage)
  })

  it('AC-4: progress stops at 1', () => {
    expect(growth(robusta, 36).progress).toBe(0.5)
    expect(growth(robusta, 72).progress).toBe(1)
    expect(growth(robusta, 1000).progress).toBe(1)
  })

  it('AC-4: counts from plantedHour', () => {
    expect(growth({ variety: 'robusta', plantedHour: 100 }, 118).stage).toBe('wachstum')
  })

  it('AC-4: moves the stage boundaries with the config', () => {
    const cfg = balance()
    const test = {
      ...cfg,
      farm: {
        ...cfg.farm,
        visualStages: { setzling: 0, wachstum: 0.5, bluete: 0.75, fruchtansatz: 0.95 },
      },
    }
    expect(growth(robusta, 18, test).stage).toBe('setzling')
    expect(growth(robusta, 36, test).stage).toBe('wachstum')
    expect(growth(robusta, 54, test).stage).toBe('bluete')
    expect(growth(robusta, 69, test).stage).toBe('fruchtansatz')
  })
})

describe('quotePlant (S13)', () => {
  it('AC-3: gives the seed cost in hundredths of CC, rounded up to whole CC', () => {
    expect(quotePlant(testState(), 'robusta', 2)).toBe(500)
    expect(quotePlant(testState(), 'arabicaStandard', 2)).toBe(900)
    expect(quotePlant(testState(), 'robusta', 0)).toBe(0)
  })
})

describe('Plant with bought seed (S19b)', () => {
  const withSeeds = (robusta: number, state = testState()): GameState => ({
    ...state,
    market: { ...state.market, seeds: { robusta } },
  })
  const buy = (state: GameState, units: number) =>
    dispatch(state, { type: 'Buy', variety: 'robusta', units })

  it('AC-1: takes the seed from the stock and buys nothing', () => {
    const state = withSeeds(3)
    expect(quotePlant(state, 'robusta', 2)).toBe(0)
    const next = plant(state, 'robusta', [0, 0], [1, 0])
    expect(next.money).toBe(state.money)
    expect(next.market.seeds.robusta).toBe(1)
    expect(next.market.volumes).toEqual(state.market.volumes)
  })

  it('AC-2: buys only the missing seed at the Buy cost', () => {
    const state = withSeeds(1, buy(testState(), 5))
    const buyCost = state.money - buy(state, 2).money
    // All seed volumes are from today, so their sum is today's volume.
    const volume = (s: GameState) =>
      s.market.volumes.filter((v) => v.kind === 'seed').reduce((sum, v) => sum + v.units, 0)
    expect(quotePlant(state, 'robusta', 3)).toBe(buyCost)
    const next = plant(state, 'robusta', [0, 0], [1, 0], [2, 0])
    expect(state.money - next.money).toBe(buyCost)
    expect(next.market.seeds.robusta).toBe(0)
    expect(volume(next)).toBe(volume(state) + 2)
  })

  it('AC-3: pays the bank price after earlier purchases and raises it', () => {
    const state = withSeeds(0, buy(testState(), 20))
    const price = bankSellPrice(state, 'robusta')
    const seedCents = balance().varieties.robusta.seedCost * 100
    const next = plant(state, 'robusta', [0, 0], [1, 0], [2, 0])
    expect(state.money - next.money).toBe(Math.ceil(3 * bankSellPrice(state, 'robusta', 3)) * 100)
    expect(state.money - next.money).toBeGreaterThan(3 * seedCents)
    expect(bankSellPrice(next, 'robusta')).toBeGreaterThan(price)
  })

  it.each<[string, GameState, Variety, [number, number][]]>([
    [
      'not enough money for the missing seed',
      withSeeds(1, testState(399)),
      'robusta',
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    ],
    [
      'a locked variety',
      { ...testState(), market: { volumes: [], seeds: { arabicaPremium: 5 } } },
      'arabicaPremium',
      [[0, 0]],
    ],
    [
      'a parcel that is not owned',
      withSeeds(5),
      'robusta',
      [
        [0, 0],
        [3, 3],
      ],
    ],
    [
      'a parcel that is taken',
      withSeeds(5, plant(testState(), 'robusta', [2, 0])),
      'robusta',
      [
        [0, 0],
        [2, 0],
      ],
    ],
  ])('AC-4: rejects %s and changes nothing', (_, state, variety, parcels) => {
    const before = structuredClone(state)
    expect(() => plant(state, variety, ...parcels)).toThrow()
    expect(state).toEqual(before)
  })

  it('AC-5: costs the seed cost at the mid volume of a neutral market with no stock', () => {
    const state = testState()
    expect(quotePlant(state, 'robusta', 2)).toBe(500)
    const next = plant(state, 'robusta', [0, 0], [1, 0])
    expect(state.money - next.money).toBe(500)
    expect(next.market.seeds.robusta).toBe(0)
  })

  it.each([
    [0, 1],
    [0, 50],
    [10, 50],
    [5, 64],
  ])(
    'AC-3 (S21b): with %i seeds in stock, the quote for %i parcels is the cost of Plant',
    (stock, count) => {
      const big = 8
      const base = withSeeds(stock)
      const state: GameState = {
        ...base,
        world: testWorld(big),
        farm: {
          ...base.farm,
          parcels: Object.fromEntries(Array.from({ length: count }, (_, i) => [i, 0])),
        },
      }
      const list = Array.from({ length: count }, (_, i) => ({ x: i % big, y: Math.floor(i / big) }))
      const next = dispatch(state, { type: 'Plant', variety: 'robusta', parcels: list })
      expect(quotePlant(state, 'robusta', count)).toBe(state.money - next.money)
    },
  )
})

describe('Premium and Specialty (S48, #17)', () => {
  // Parcel (1,0) is cool highland, (0,0) is lowland. Capital is the balance here: no stock and nothing invested.
  function zoned(money: number): GameState {
    const state = testState(money)
    const parcels = state.world.parcels.map((p) =>
      p.x === 1 && p.y === 0 ? { ...p, zone: 'hochlandKuehl' as const } : p,
    )
    return { ...state, world: { ...state.world, parcels } }
  }

  it('AC-2: Specialty plants on lowland and cool highland from 10.000 CC capital', () => {
    const below = zoned(999999)
    const before = structuredClone(below)
    expect(() => plant(below, 'specialty', [0, 0])).toThrow(/locked/)
    expect(() => plant(below, 'specialty', [1, 0])).toThrow(/locked/)
    expect(below).toEqual(before)
    const next = plant(zoned(1000000), 'specialty', [0, 0], [1, 0])
    expect(next.farm.plants[0]?.variety).toBe('specialty')
    expect(next.farm.plants[1]?.variety).toBe('specialty')
  })

  it('AC-2: the Specialty forecast has the off-zone factor on lowland only', () => {
    expect(balance().varieties.specialty.zone).toBe('hochlandKuehl')
    const next = plant(zoned(1000000), 'specialty', [0, 0], [1, 0])
    const full = (zoneMatches: boolean) =>
      computeYield({ variety: 'specialty', soilClass: 'gut', zoneMatches, fertilized: false })
    const { baseYield } = balance().varieties.specialty
    expect(full(true)).toBe(Math.floor(baseYield + 1e-9))
    expect(full(false)).toBe(Math.floor(baseYield * balance().world.offZoneYieldFactor + 1e-9))
    expect(forecastYield(next, 1, 0)).toBe(full(true))
    expect(forecastYield(next, 0, 0)).toBe(full(false))
    expect(full(false)).toBeLessThan(full(true))
  })

  it('AC-2: Arabica Premium plants at 2.000 CC capital and takes the seed cost', () => {
    const state = zoned(200000)
    const cost = quotePlant(state, 'arabicaPremium', 1)
    expect(cost).toBeGreaterThan(0)
    const next = plant(state, 'arabicaPremium', [0, 0])
    expect(next.farm.plants[0]).toEqual({ variety: 'arabicaPremium', plantedHour: 5 })
    expect(next.money).toBe(200000 - cost)
  })
})
