import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { createState, type GameState } from '../state'
import type { PlantState } from './plants'
import { fieldNeedsCare, fieldStatus, fieldSummaries } from './status'

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
      cares: { fertilized: false, irrigated: false },
      open: ['Fertilize', 'Irrigate'],
    })
  })

  it('AC-1: lists only the cares that the plant does not have', () => {
    const status = fieldStatus(testState(30, { irrigated: true }), 0, 0)!
    expect(status.cares).toEqual({ fertilized: false, irrigated: true })
    expect(status.open).toEqual(['Fertilize'])
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
    const done = { fertilized: true, irrigated: true }
    expect(fieldNeedsCare(testState(30, done), 0)).toBe(false)
    expect(fieldNeedsCare(testState(72), 0)).toBe(false)
  })
})

describe('fieldSummaries (S59)', () => {
  const cared = { fertilized: true, irrigated: true }
  // Field A owns parcels 0-2, field B owns parcel 3 and has no plant.
  function farm(hour: number, plants: Record<number, PlantState>): GameState {
    const state = createState(1)
    return {
      ...state,
      time: { ...state.time, hour },
      farm: {
        ...state.farm,
        parcels: { 0: 0, 1: 0, 2: 0, 3: 1 },
        fields: [
          { id: 0, name: 'A' },
          { id: 1, name: 'B' },
        ],
        plants,
      },
    }
  }
  const robusta = (plantedHour: number, extra: Partial<PlantState> = cared): PlantState => ({
    variety: 'robusta',
    plantedHour,
    ...extra,
  })

  it('AC-1: gives no row for a field without plants, and a fresh field', () => {
    expect(fieldSummaries(farm(0, {}))).toEqual([])
    expect(fieldSummaries(farm(0, { 0: robusta(0) }))).toEqual([
      {
        id: 0,
        name: 'A',
        variety: 'robusta',
        parcels: 3,
        stage: 'setzling',
        percent: 0,
        state: null,
      },
    ])
  })

  it('AC-1: one ripe plant gives ripe, with the floor of the mean progress', () => {
    // Robusta ripens after 72 hours: progress 1 and 0.5 give 75 %.
    expect(fieldSummaries(farm(72, { 0: robusta(0), 1: robusta(36, {}) }))).toEqual([
      {
        id: 0,
        name: 'A',
        variety: 'robusta',
        parcels: 3,
        stage: 'bluete',
        percent: 75,
        state: 'ripe',
      },
    ])
    expect(fieldSummaries(farm(72, { 0: robusta(0) }))[0]).toMatchObject({
      stage: 'reif',
      percent: 100,
    })
  })

  it('AC-1: one overripe plant gives overripe before ripe', () => {
    const late = 72 + (balance().farm.overripe.graceDays + 1) * 24
    const [row] = fieldSummaries(farm(late, { 0: robusta(0), 1: robusta(late - 72) }))
    expect(row).toMatchObject({ stage: 'reif', percent: 100, state: 'overripe' })
  })

  it('AC-1: an unripe field without fertilizer gives care', () => {
    const [row] = fieldSummaries(farm(30, { 0: robusta(0, { irrigated: true }) }))
    expect(row).toMatchObject({ stage: 'wachstum', percent: 41, state: 'care' })
  })

  it('AC-1: a field with mixed varieties gives the majority variety', () => {
    expect(balance().varieties.arabicaStandard.cycleDays).toBe(5)
    const arabica: PlantState = { variety: 'arabicaStandard', plantedHour: 0, ...cared }
    // 30/72 and 30/120 give a mean of 1/3.
    const tie = fieldSummaries(farm(30, { 0: arabica, 1: robusta(0) }))
    expect(tie[0]).toMatchObject({ variety: 'robusta', percent: 33 })
    const two = fieldSummaries(farm(30, { 0: arabica, 1: robusta(0), 2: arabica }))
    expect(two[0]).toMatchObject({ variety: 'arabicaStandard', stage: 'wachstum', percent: 30 })
  })
})
