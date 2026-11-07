import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { createState, type GameState } from '../state'
import { step } from '../time/time'
import type { Parcel, World } from '../world/types'
import { soilClassOf } from '../world/generate'
import { monthlyUpkeep } from './daily'
import { monthlyLoss } from './storage'

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
      plants: { 2: { variety: 'robusta', plantedDay: 0 } },
    },
    storage: {
      batches: [
        { variety: 'robusta', units: 30, quality: 100, storedDay: 0 },
        { variety: 'arabicaStandard', units: 20, quality: 0.5, storedDay: 0 },
      ],
    },
  }
}

const monthlyCost = (units: number) =>
  Math.round(units * balance().storage.costPerUnitPerMonth * 100)

describe('monthlyUpkeep', () => {
  it('AC-1: charges the storage cost per stored unit', () => {
    const state = testState()
    expect(monthlyUpkeep(state).money).toBe(state.money - monthlyCost(50))
    const empty = { ...state, storage: { batches: [] } }
    expect(monthlyUpkeep(empty).money).toBe(state.money)
  })

  it('AC-2: lowers batch quality and stops at 0', () => {
    const loss = monthlyLoss(0)
    expect(loss).toBeGreaterThanOrEqual(0.5)
    expect(monthlyUpkeep(testState()).storage.batches).toEqual([
      { variety: 'robusta', units: 30, quality: 100 - loss, storedDay: 0 },
      { variety: 'arabicaStandard', units: 20, quality: 0, storedDay: 0 },
    ])
  })

  it('AC-3: owned fallow parcels recover fertility up to 100', () => {
    const cfg = balance()
    const parcels = monthlyUpkeep(testState()).world.parcels
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
    monthlyUpkeep(state)
    expect(state).toEqual(before)
  })
})

describe('step', () => {
  const run = (state: GameState, days: number) => {
    const states = [state]
    for (let i = 0; i < days; i++) states.push(step(states[i]!))
    return states
  }
  const upkeep = (s: GameState) => ({
    money: s.money,
    batches: s.storage.batches,
    fertility: s.world.parcels[0]!.fertility,
  })

  it('AC-3: changes nothing on days 1 to 29 and books the upkeep once on day 30', () => {
    const loss = monthlyLoss(0)
    const states = run(testState(), 60)
    for (let day = 1; day < 30; day++) expect(upkeep(states[day]!)).toEqual(upkeep(states[0]!))
    expect(upkeep(states[30]!)).toEqual(upkeep(monthlyUpkeep(states[0]!)))
    for (let day = 31; day < 60; day++) expect(upkeep(states[day]!)).toEqual(upkeep(states[30]!))
    expect(states[60]!.storage.batches[0]!.quality).toBe(100 - 2 * loss)
  })

  it('#9: older batches lose more quality per month', () => {
    const stages = balance().storage.qualityLossByAge
    const old = stages[stages.length - 1]!
    const state = testState()
    const day = old.fromMonth * balance().time.daysPerMonth
    const aged = { ...state, time: { ...state.time, day } }
    expect(monthlyUpkeep(aged).storage.batches[0]!.quality).toBe(100 - old.loss)
    expect(old.loss).toBeGreaterThan(monthlyLoss(0))
  })

  it('AC-3: 50 units cost 1 CC per month, 51 units cost 2 CC', () => {
    const cost = (units: number) => {
      const state = {
        ...createState(1),
        storage: { batches: [{ variety: 'robusta' as const, units, quality: 100, storedDay: 0 }] },
      }
      const states = run(state, 30)
      return state.money - states[30]!.money
    }
    expect([cost(50), cost(51)]).toEqual([100, 200])
  })
})
