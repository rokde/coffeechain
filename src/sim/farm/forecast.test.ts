import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import type { Parcel, World } from '../world/types'
import { forecastYield } from './forecast'
import { overripeFactor } from './overripe'
import type { PlantState } from './plants'
import { computeYield } from './yield'

const size = 4
const day = balance().time.ticksPerGameDay
const ripeHour = 5 + balance().varieties.robusta.cycleDays * day
const lateHour = ripeHour + (balance().farm.overripe.graceDays + 2) * day

function testState(plant: PlantState | undefined, hour = ripeHour): GameState {
  const state = createState(1)
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      parcels.push({
        x,
        y,
        height: 0.2,
        zone: 'tiefland',
        fertility: 50,
        waterRetention: 50,
        soilQuality: 0.5,
        soilClass: 'gut',
      })
  const world: World = { seed: 7, size, parcels, start: { x: 1, y: 1 } }
  return {
    ...state,
    world,
    time: { ...state.time, hour },
    farm: {
      ...state.farm,
      parcels: { 0: 0 },
      fields: [{ id: 0, name: 'A' }],
      plants: plant ? { 0: plant } : {},
    },
  }
}

const base = (fertilized: boolean) =>
  computeYield({ variety: 'robusta', soilClass: 'gut', zoneMatches: true, fertilized })

describe('forecastYield', () => {
  it('AC-1: returns null for a parcel without a plant', () => {
    expect(forecastYield(testState(undefined), 0, 0)).toBeNull()
    expect(forecastYield(testState({ variety: 'robusta', plantedHour: 5 }), 1, 0)).toBeNull()
  })

  it('AC-2: equals computeYield without random, and fertilizer raises it', () => {
    const plain = forecastYield(testState({ variety: 'robusta', plantedHour: 5 }), 0, 0)
    const fertilized = forecastYield(
      testState({ variety: 'robusta', plantedHour: 5, fertilized: true }),
      0,
      0,
    )
    expect(plain).toBe(base(false))
    expect(fertilized).toBe(base(true))
    expect(fertilized).toBeGreaterThan(plain!)
  })

  it('AC-2: shows the same value before the plant is ripe', () => {
    const plant = { variety: 'robusta' as const, plantedHour: 5 }
    expect(forecastYield(testState(plant, 5), 0, 0)).toBe(base(false))
  })

  it('AC-3: applies the overripe factor to an overripe plant', () => {
    const plant = { variety: 'robusta' as const, plantedHour: 5 }
    const factor = overripeFactor(plant, lateHour)
    expect(factor).toBeLessThan(1)
    const late = forecastYield(testState(plant, lateHour), 0, 0)
    expect(late).toBe(Math.floor(base(false) * factor + 1e-9))
    expect(late).toBeLessThan(forecastYield(testState(plant), 0, 0)!)
  })

  it('AC-4: scales pendingUnits by the new and the stored factor', () => {
    const plant = { variety: 'robusta' as const, plantedHour: 5, pendingUnits: 10 }
    expect(forecastYield(testState(plant), 0, 0)).toBe(10)
    const stored = { ...plant, overripeFactor: 0.85 }
    const factor = overripeFactor(plant, lateHour)
    expect(forecastYield(testState(stored, lateHour), 0, 0)).toBe(
      Math.floor((10 * factor) / 0.85 + 1e-9),
    )
    expect(forecastYield(testState({ ...plant, overripeFactor: 0 }), 0, 0)).toBe(0)
  })

  it('AC-4: equals the units that harvest() takes with free storage', () => {
    const plant = {
      variety: 'robusta' as const,
      plantedHour: 5,
      pendingUnits: 10,
      overripeFactor: 0.85,
    }
    const state = testState(plant, lateHour)
    const next = dispatch(state, { type: 'Harvest', parcels: [{ x: 0, y: 0 }] })
    const units = next.storage.batches.reduce((sum, b) => sum + b.units, 0)
    expect(forecastYield(state, 0, 0)).toBe(units)
  })
})
