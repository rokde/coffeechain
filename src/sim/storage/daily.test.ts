import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { createState, type GameState } from '../state'
import { step } from '../time/time'
import type { Parcel, World } from '../world/types'
import { soilClassOf } from '../world/generate'
import { dailyUpkeep } from './daily'

const size = 4

function testWorld(): World {
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const soil = { fertility: 50, waterRetention: 50, soilQuality: 0.5 }
      parcels.push({ x, y, height: 0.2, zone: 'tiefland', ...soil, soilClass: 'gut' })
    }
  }
  parcels[1] = { ...parcels[1]!, fertility: 99.8 }
  return { seed: 7, size, parcels, start: { x: 1, y: 1 } }
}

// Owns parcels 0 to 2. Parcel 2 has a plant. Parcel 3 is not owned.
function testState(): GameState {
  const state = createState(1)
  return {
    ...state,
    world: testWorld(),
    farm: {
      ...state.farm,
      parcels: { 0: 0, 1: 0, 2: 0 },
      fields: [{ id: 0, name: 'A' }],
      plants: { 2: { variety: 'robusta', plantedHour: 0 } },
    },
    storage: {
      batches: [
        { variety: 'robusta', units: 30, quality: 100 },
        { variety: 'arabicaStandard', units: 20, quality: 0.5 },
      ],
    },
  }
}

const dailyCost = (units: number) => Math.round(units * balance().storage.costPerUnitPerDay * 100)

describe('dailyUpkeep', () => {
  it('AC-1: charges the storage cost per stored unit', () => {
    const state = testState()
    expect(dailyUpkeep(state).money).toBe(state.money - dailyCost(50))
    const empty = { ...state, storage: { batches: [] } }
    expect(dailyUpkeep(empty).money).toBe(state.money)
  })

  it('AC-2: lowers batch quality and stops at 0', () => {
    const loss = balance().storage.qualityLossPerDayRaw
    expect(loss).toBeGreaterThanOrEqual(0.5)
    expect(dailyUpkeep(testState()).storage.batches).toEqual([
      { variety: 'robusta', units: 30, quality: 100 - loss },
      { variety: 'arabicaStandard', units: 20, quality: 0 },
    ])
  })

  it('AC-3: owned fallow parcels recover fertility up to 100', () => {
    const cfg = balance()
    const parcels = dailyUpkeep(testState()).world.parcels
    const fertility = 50 + cfg.soil.fertilityRecoveryPerFallowDay
    const soilQuality = (fertility + 50) / 200
    expect(parcels[0]).toMatchObject({
      fertility,
      soilQuality,
      soilClass: soilClassOf(soilQuality, cfg.soil.classMinQuality),
    })
    expect(parcels[1]).toMatchObject({ fertility: 100, soilQuality: 0.75 })
    expect(parcels[2]!.fertility).toBe(50)
    expect(parcels[3]!.fertility).toBe(50)
  })

  it('AC-4: does not change the input state', () => {
    const state = testState()
    const before = structuredClone(state)
    dailyUpkeep(state)
    expect(state).toEqual(before)
  })
})

describe('step', () => {
  it('AC-5: applies the upkeep once at the start of each game day', () => {
    const loss = balance().storage.qualityLossPerDayRaw
    let state: GameState = {
      ...createState(1),
      storage: { batches: [{ variety: 'robusta', units: 50, quality: 100 }] },
    }
    const money = state.money
    const ticks = balance().time.ticksPerGameDay
    for (let i = 1; i <= 2 * ticks; i++) {
      state = step(state)
      const days = Math.floor(i / ticks)
      expect(state.storage.batches[0]!.quality).toBe(100 - days * loss)
      expect(state.money).toBe(money - days * dailyCost(50))
    }
  })
})
