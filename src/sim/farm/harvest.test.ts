import { afterEach, describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { mulberry32 } from '../rng'
import { createState, type GameState } from '../state'
import { storageUsed } from '../storage/storage'
import { soilClassOf } from '../world/generate'
import type { Parcel, World } from '../world/types'
import { harvestSeed } from './harvest'
import { baseQuality, finalQuality, qualityRandom } from './quality'
import { computeYield, yieldRandom } from './yield'

const size = 4
const seed = 7

function testWorld(): World {
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const soil = { fertility: 50, waterRetention: 50, soilQuality: 0.5 }
      parcels.push({ x, y, height: 0.2, zone: 'tiefland', ...soil, soilClass: 'gut' })
    }
  }
  return { seed, size, parcels, start: { x: 1, y: 1 } }
}

// Owns (0,0) to (3,0). Ripe Robusta on (0,0) and (1,0), unripe Robusta on (2,0), (3,0) is empty.
function testState(): GameState {
  const state = createState(1)
  const ripeDay = 5 + balance().varieties.robusta.cycleDays
  return {
    ...state,
    world: testWorld(),
    time: { ...state.time, day: ripeDay },
    farm: {
      ...state.farm,
      parcels: { 0: 0, 1: 0, 2: 0, 3: 0 },
      fields: [{ id: 0, name: 'A' }],
      plants: {
        0: { variety: 'robusta', plantedDay: 5 },
        1: { variety: 'robusta', plantedDay: 5 },
        2: { variety: 'robusta', plantedDay: ripeDay },
      },
    },
  }
}

const harvest = (state: GameState, ...parcels: [number, number][]) =>
  dispatch(state, { type: 'Harvest', parcels: parcels.map(([x, y]) => ({ x, y })) })

function expectedYield(state: GameState, index: number, fertilized: boolean): number {
  const random = yieldRandom(mulberry32(harvestSeed(seed, state.time.day, index)))
  return computeYield({
    variety: 'robusta',
    soilClass: 'gut',
    zoneMatches: true,
    fertilized,
    random,
  })
}

// Quality points before overripeness. The quality roll is the second draw after the yield roll.
function expectedBase(state: GameState, index: number, care = {}): number {
  const rng = mulberry32(harvestSeed(seed, state.time.day, index))
  yieldRandom(rng)
  return baseQuality({
    soilClass: 'gut',
    zoneMatches: true,
    fertilized: false,
    irrigated: false,
    ...care,
    random: qualityRandom(rng),
  })
}

const expectedQuality = (state: GameState, index: number) =>
  finalQuality(expectedBase(state, index), 1, false)

describe('Harvest', () => {
  it('AC-1: stores the seeded yield as one batch and removes the plant', () => {
    const state = testState()
    const before = structuredClone(state)
    const next = harvest(state, [0, 0])
    const units = expectedYield(state, 0, false)
    expect(next.storage.batches).toEqual([
      { variety: 'robusta', units, quality: expectedQuality(state, 0), storedDay: state.time.day },
    ])
    expect(next.farm.plants[0]).toBeUndefined()
    expect(harvest(state, [0, 0]).storage).toEqual(next.storage)
    expect(state).toEqual(before)
  })

  it('#21: puts the units of one variety and quality into one batch', () => {
    const { quality } = balance().farm
    const range = quality.randomRange
    quality.randomRange = [0, 0]
    try {
      const state = testState()
      const units = expectedYield(state, 0, false) + expectedYield(state, 1, false)
      expect(harvest(state, [0, 0], [1, 0]).storage.batches).toEqual([
        { variety: 'robusta', units, quality: 72, storedDay: state.time.day },
      ])

      state.farm.plants[1] = { ...state.farm.plants[1]!, irrigated: true }
      expect(harvest(state, [0, 0], [1, 0]).storage.batches).toEqual([
        {
          variety: 'robusta',
          units: expectedYield(state, 0, false),
          quality: 72,
          storedDay: state.time.day,
        },
        {
          variety: 'robusta',
          units: expectedYield(state, 1, false),
          quality: 77,
          storedDay: state.time.day,
        },
      ])
    } finally {
      quality.randomRange = range
    }
  })

  it('#21: care raises the quality, the seed fixes the random part', () => {
    const state = testState()
    state.farm.plants[0] = { ...state.farm.plants[0]!, fertilized: true, irrigated: true }
    const quality = harvest(state, [0, 0]).storage.batches[0]!.quality
    expect(quality).toBe(
      finalQuality(expectedBase(state, 0, { fertilized: true, irrigated: true }), 1, false),
    )
    expect(quality).toBeGreaterThan(harvest(testState(), [0, 0]).storage.batches[0]!.quality)
    expect(Number.isInteger(quality)).toBe(true)
  })

  it('AC-2: a fertilized plant gives the fertilized yield, which is higher', () => {
    const state = testState()
    state.farm.plants[0] = { ...state.farm.plants[0]!, fertilized: true }
    const fertilized = harvest(state, [0, 0]).storage.batches[0]!.units
    expect(fertilized).toBe(expectedYield(state, 0, true))
    expect(fertilized).toBeGreaterThan(harvest(testState(), [0, 0]).storage.batches[0]!.units)
  })

  it('AC-3: lowers fertility and updates soilQuality and soilClass', () => {
    const loss = balance().soil.fertilityLossPerHarvest
    const parcel = harvest(testState(), [0, 0]).world.parcels[0]!
    expect(parcel.fertility).toBe(50 - loss)
    expect(parcel.soilQuality).toBe((50 - loss + 50) / 200)
    expect(parcel.soilClass).toBe(soilClassOf(parcel.soilQuality, balance().soil.classMinQuality))
    expect(parcel.soilClass).toBe('mittel')
  })

  it('AC-3: keeps fertility at minimum 0', () => {
    const state = testState()
    state.world.parcels[0] = { ...state.world.parcels[0]!, fertility: 1 }
    expect(harvest(state, [0, 0]).world.parcels[0]!.fertility).toBe(0)
  })
})

describe('capacity limit', () => {
  const full = (used: number) => {
    const state = testState()
    return {
      ...state,
      storage: {
        batches: [{ variety: 'robusta' as const, units: used, quality: 100, storedDay: 0 }],
      },
    }
  }

  it('AC-4: stores only the free capacity and keeps the rest on the plant', () => {
    expect(balance().storage.startCapacity).toBe(100)
    const state = full(90)
    const units = expectedYield(state, 0, false)
    expect(units).toBeGreaterThan(10)
    const next = harvest(state, [0, 0])
    const quality = expectedQuality(state, 0)
    expect(next.storage.batches[1]).toEqual({
      variety: 'robusta',
      units: 10,
      quality,
      storedDay: state.time.day,
    })
    expect(storageUsed(next.storage)).toBe(100)
    expect(next.farm.plants[0]).toEqual({
      variety: 'robusta',
      plantedDay: 5,
      pendingUnits: units - 10,
      pendingQuality: expectedBase(state, 0),
    })

    const emptied = { ...next, storage: { batches: [] } }
    const later = { ...emptied, time: { ...emptied.time, day: emptied.time.day + 3 } }
    const last = harvest(later, [0, 0])
    expect(last.storage.batches).toEqual([
      { variety: 'robusta', units: units - 10, quality, storedDay: later.time.day },
    ])
    expect(last.farm.plants[0]).toBeUndefined()
    const loss = balance().soil.fertilityLossPerHarvest
    expect(last.world.parcels[0]!.fertility).toBe(50 - loss)
  })

  it('AC-4: a full storage stores nothing and keeps all units', () => {
    const state = full(100)
    const next = harvest(state, [0, 0])
    expect(next.storage).toEqual(state.storage)
    expect(next.farm.plants[0]!.pendingUnits).toBe(expectedYield(state, 0, false))
  })

  it('S45 AC-2: a Lager-Ausbau raises the limit to the capacity of its stage', () => {
    const upgraded = { ...full(240), buildings: { 3: { kind: 'storage' as const } } }
    expect(balance().storage.upgrades[0]!.capacity).toBe(250)
    const units = expectedYield(upgraded, 0, false)
    expect(units).toBeGreaterThan(10)
    const next = harvest(upgraded, [0, 0])
    expect(next.storage.batches[1]).toEqual({
      variety: 'robusta',
      units: 10,
      quality: expectedQuality(upgraded, 0),
      storedDay: upgraded.time.day,
    })
    expect(storageUsed(next.storage)).toBe(250)
    expect(next.farm.plants[0]!.pendingUnits).toBe(units - 10)
  })
})

describe('rejected harvest', () => {
  it.each<[string, [number, number][]]>([
    [
      'a parcel outside the map',
      [
        [0, 0],
        [4, 0],
      ],
    ],
    [
      'a parcel that is not owned',
      [
        [0, 0],
        [3, 3],
      ],
    ],
    [
      'a parcel with no plant',
      [
        [0, 0],
        [3, 0],
      ],
    ],
    [
      'a plant that is not ripe',
      [
        [0, 0],
        [2, 0],
      ],
    ],
  ])('AC-5: rejects %s and changes nothing', (_, parcels) => {
    const state = testState()
    const before = structuredClone(state)
    expect(() => harvest(state, ...parcels)).toThrow()
    expect(state).toEqual(before)
  })
})

describe('overripe', () => {
  const cfg = balance()
  // One month of late days costs as much as one late game day before #27.
  const month = cfg.time.daysPerMonth
  const { graceDays } = cfg.farm.overripe
  // testState() has its plants ripe at its start day.
  const at = (state: GameState, day: number): GameState => ({
    ...state,
    time: { ...state.time, day },
  })
  const late = (months: number) => {
    const state = testState()
    return at(state, state.time.day + graceDays + months * month)
  }

  afterEach(() => {
    cfg.farm.overripe.enabled = true
  })

  it('AC-3: enabled, one late month gives 85 % and the grace period gives the full yield', () => {
    expect(cfg.farm.overripe.enabled).toBe(true)
    const state = late(1)
    const units = harvest(state, [0, 0]).storage.batches[0]!.units
    expect(units).toBe(Math.floor(expectedYield(state, 0, false) * 0.85 + 1e-9))
    expect(units).toBeLessThan(expectedYield(state, 0, false))

    const grace = at(testState(), testState().time.day + graceDays)
    expect(harvest(grace, [0, 0]).storage.batches[0]!.units).toBe(expectedYield(grace, 0, false))
  })

  it('#21: overripeness lowers the quality', () => {
    const state = late(1)
    const quality = harvest(state, [0, 0]).storage.batches[0]!.quality
    expect(quality).toBe(finalQuality(expectedBase(state, 0), 0.85, false))
    expect(quality).toBeLessThan(expectedQuality(state, 0))
  })

  it('AC-4: disabled, a harvest 150 days after ripeness gives the full yield', () => {
    cfg.farm.overripe.enabled = false
    const state = at(testState(), testState().time.day + 150)
    expect(harvest(state, [0, 0]).storage.batches[0]!.units).toBe(expectedYield(state, 0, false))
  })

  it('AC-5: units that stay on the plant lose their share too', () => {
    const state = late(1)
    const almostFull = {
      ...state,
      storage: {
        batches: [{ variety: 'robusta' as const, units: 95, quality: 100, storedDay: 0 }],
      },
    }
    const next = harvest(almostFull, [0, 0])
    const first = Math.floor(expectedYield(state, 0, false) * 0.85 + 1e-9)
    const pending = first - 5
    expect(pending).toBeGreaterThan(0)
    expect(next.farm.plants[0]!.pendingUnits).toBe(pending)
    expect(next.farm.plants[0]!.overripeFactor).toBeCloseTo(0.85, 9)

    const emptied = at({ ...next, storage: { batches: [] } }, next.time.day + month)
    const last = harvest(emptied, [0, 0])
    expect(last.storage.batches).toEqual([
      {
        variety: 'robusta',
        units: Math.floor((pending * 0.7) / 0.85 + 1e-9),
        quality: finalQuality(expectedBase(state, 0), 0.7, false),
        storedDay: emptied.time.day,
      },
    ])
    expect(last.farm.plants[0]).toBeUndefined()

    const rotten = at({ ...next, storage: { batches: [] } }, next.time.day + 10 * month)
    const gone = harvest(rotten, [0, 0])
    expect(gone.storage.batches).toEqual([])
    expect(gone.farm.plants[0]).toBeUndefined()
  })

  it('AC-5: a first harvest at factor 0 stores nothing and removes the plant', () => {
    const next = harvest(late(10), [0, 0])
    expect(next.storage.batches).toEqual([])
    expect(next.farm.plants[0]).toBeUndefined()
  })
})

describe('Harvest milestone (S49)', () => {
  const stored = (s: GameState) => s.storage.batches.reduce((n, b) => n + b.units, 0)
  const withMilestones = (s: GameState, m: GameState['milestones']): GameState => ({
    ...s,
    milestones: m,
  })

  it('AC-1: counts stored units only', () => {
    const state = testState()
    expect(state.milestones).toEqual({ harvested: 0 })
    const next = harvest(state, [0, 0], [1, 0])
    expect(next.milestones.harvested).toBe(stored(next))
    const full = {
      ...state,
      storage: { batches: [{ variety: 'robusta' as const, units: 100, quality: 1, storedDay: 0 }] },
    }
    expect(harvest(full, [0, 0]).milestones.harvested).toBe(0)
  })

  it('AC-2: sets harvestProDay once at the threshold', () => {
    const limit = balance().progression.harvestProUnits
    const state = withMilestones(testState(), { harvested: limit - 1 })
    const next = harvest(state, [0, 0])
    expect(next.milestones.harvestProDay).toBe(state.time.day)
    const later = harvest({ ...next, time: { ...next.time, day: next.time.day + 5 } }, [1, 0])
    expect(later.milestones.harvestProDay).toBe(state.time.day)
    expect(harvest(testState(), [0, 0]).milestones.harvestProDay).toBeUndefined()
  })

  it('AC-3: the bonus applies from the harvest after the milestone', () => {
    const state = withMilestones(testState(), { harvested: 999 })
    const reach = harvest(state, [0, 0])
    expect(reach.milestones.harvestProDay).toBeDefined()
    expect(reach.storage.batches[0]!.quality).toBe(expectedQuality(state, 0))
    const next = harvest(reach, [1, 0])
    expect(next.storage.batches[1]!.quality).toBe(finalQuality(expectedBase(reach, 1), 1, true))
  })
})
