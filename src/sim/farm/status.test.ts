import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { createState, type GameState } from '../state'
import type { PlantState } from './plants'
import { fieldNeedsCare, fieldStatus } from './status'

// Owns (0,0) and (1,0) as field A. Robusta planted at hour 0 on (0,0), (1,0) is empty.
function testState(hour: number, plant: Partial<PlantState> = {}): GameState {
  const state = createState(1)
  return {
    ...state,
    time: { ...state.time, hour },
    farm: {
      ...state.farm,
      parcels: { 0: 0, 1: 0 },
      fields: [{ id: 0, name: 'A' }],
      plants: { 0: { variety: 'robusta', plantedHour: 0, ...plant } },
    },
  }
}

describe('fieldStatus', () => {
  it('AC-1: gives null for an empty parcel and the growth at hour 30', () => {
    expect(balance().varieties.robusta.cycleDays).toBe(3)
    expect(balance().time.ticksPerGameDay).toBe(24)
    expect(fieldStatus(testState(30), 1, 0)).toBeNull()
    expect(fieldStatus(testState(30), 0, 0)).toEqual({
      stage: 'wachstum',
      percent: 41,
      daysToRipe: 2,
      daysToOverripe: null,
      overripe: false,
      cares: { fertilized: false, irrigated: false, pestProtected: false },
      open: ['Fertilize', 'Irrigate', 'ProtectPests'],
    })
  })

  it('AC-1: lists only the cares that the plant does not have', () => {
    const status = fieldStatus(testState(30, { irrigated: true }), 0, 0)!
    expect(status.cares).toEqual({ fertilized: false, irrigated: true, pestProtected: false })
    expect(status.open).toEqual(['Fertilize', 'ProtectPests'])
  })

  it('AC-2: gives the days until overripe for a ripe plant', () => {
    expect(fieldStatus(testState(72), 0, 0)).toMatchObject({
      stage: 'reif',
      percent: 100,
      daysToRipe: null,
      daysToOverripe: 3,
      overripe: false,
      open: [],
    })
    expect(fieldStatus(testState(143), 0, 0)).toMatchObject({ daysToOverripe: 1, overripe: false })
    expect(fieldStatus(testState(144), 0, 0)).toMatchObject({
      overripe: true,
      daysToOverripe: null,
    })
  })

  it('AC-2: gives no days until overripe when overripe is disabled', () => {
    const cfg = structuredClone(balance())
    cfg.farm.overripe.enabled = false
    expect(fieldStatus(testState(72), 0, 0, cfg)).toMatchObject({
      daysToOverripe: null,
      overripe: false,
    })
  })
})

describe('fieldNeedsCare', () => {
  it('AC-5: is true only while an unripe plant misses a care', () => {
    expect(fieldNeedsCare(testState(30), 0)).toBe(true)
    expect(fieldNeedsCare(testState(30), 1)).toBe(false)
    const done = { fertilized: true, irrigated: true, pestProtected: true }
    expect(fieldNeedsCare(testState(30, done), 0)).toBe(false)
    expect(fieldNeedsCare(testState(72), 0)).toBe(false)
  })
})
