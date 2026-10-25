import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { createState, type GameState } from '../state'
import type { PlantState } from './plants'
import { fieldNeedsCare, fieldStatus, fieldSummaries } from './status'

// Owns (0,0) and (1,0) as field A. Robusta planted at day 0 on (0,0), (1,0) is empty.
function testState(day: number, plant: Partial<PlantState> = {}): GameState {
  const state = createState(1)
  return {
    ...state,
    time: { ...state.time, day },
    farm: {
      ...state.farm,
      parcels: { 0: 0, 1: 0 },
      fields: [{ id: 0, name: 'A' }],
      plants: { 0: { variety: 'robusta', plantedDay: 0, ...plant } },
    },
  }
}

describe('fieldStatus', () => {
  it('AC-1: gives null for an empty parcel and the growth at day 37', () => {
    expect(balance().varieties.robusta.cycleDays).toBe(90)
    expect(fieldStatus(testState(37), 1, 0)).toBeNull()
    expect(fieldStatus(testState(37), 0, 0)).toEqual({
      stage: 'wachstum',
      percent: 41,
      daysToRipe: 53,
      daysToOverripe: null,
      overripe: false,
      cares: { fertilized: false, irrigated: false },
      open: ['Fertilize', 'Irrigate'],
    })
  })

  it('AC-1: lists only the cares that the plant does not have', () => {
    const status = fieldStatus(testState(37, { irrigated: true }), 0, 0)!
    expect(status.cares).toEqual({ fertilized: false, irrigated: true })
    expect(status.open).toEqual(['Fertilize'])
  })

  it('AC-2: gives the days until overripe for a ripe plant', () => {
    expect(fieldStatus(testState(90), 0, 0)).toMatchObject({
      stage: 'reif',
      percent: 100,
      daysToRipe: null,
      daysToOverripe: 61,
      overripe: false,
      open: [],
    })
    expect(fieldStatus(testState(150), 0, 0)).toMatchObject({ daysToOverripe: 1, overripe: false })
    expect(fieldStatus(testState(151), 0, 0)).toMatchObject({
      overripe: true,
      daysToOverripe: null,
    })
  })

  it('AC-2: gives no days until overripe when overripe is disabled', () => {
    const cfg = structuredClone(balance())
    cfg.farm.overripe.enabled = false
    expect(fieldStatus(testState(90), 0, 0, cfg)).toMatchObject({
      daysToOverripe: null,
      overripe: false,
    })
  })
})

describe('fieldNeedsCare', () => {
  it('AC-5: is true only while an unripe plant misses a care', () => {
    expect(fieldNeedsCare(testState(37), 0)).toBe(true)
    expect(fieldNeedsCare(testState(37), 1)).toBe(false)
    const done = { fertilized: true, irrigated: true }
    expect(fieldNeedsCare(testState(37, done), 0)).toBe(false)
    expect(fieldNeedsCare(testState(90), 0)).toBe(false)
  })
})

describe('fieldSummaries (S59)', () => {
  const cared = { fertilized: true, irrigated: true }
  // Field A owns parcels 0-2, field B owns parcel 3 and has no plant.
  function farm(day: number, plants: Record<number, PlantState>): GameState {
    const state = createState(1)
    return {
      ...state,
      time: { ...state.time, day },
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
  const robusta = (plantedDay: number, extra: Partial<PlantState> = cared): PlantState => ({
    variety: 'robusta',
    plantedDay,
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
    // Robusta ripens after 90 days: progress 1 and 0.5 give 75 %.
    expect(fieldSummaries(farm(90, { 0: robusta(0), 1: robusta(45, {}) }))).toEqual([
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
    expect(fieldSummaries(farm(90, { 0: robusta(0) }))[0]).toMatchObject({
      stage: 'reif',
      percent: 100,
    })
  })

  it('AC-1: one overripe plant gives overripe before ripe', () => {
    const late = 90 + balance().farm.overripe.graceDays + 1
    const [row] = fieldSummaries(farm(late, { 0: robusta(0), 1: robusta(late - 90) }))
    expect(row).toMatchObject({ stage: 'reif', percent: 100, state: 'overripe' })
  })

  it('AC-1: an unripe field without fertilizer gives care', () => {
    const [row] = fieldSummaries(farm(37, { 0: robusta(0, { irrigated: true }) }))
    expect(row).toMatchObject({ stage: 'wachstum', percent: 41, state: 'care' })
  })

  it('AC-1: a field with mixed varieties gives the majority variety', () => {
    expect(balance().varieties.arabicaStandard.cycleDays).toBe(150)
    const arabica: PlantState = { variety: 'arabicaStandard', plantedDay: 0, ...cared }
    // 37/90 and 37/150 give a mean of 0.33.
    const tie = fieldSummaries(farm(37, { 0: arabica, 1: robusta(0) }))
    expect(tie[0]).toMatchObject({ variety: 'robusta', percent: 32 })
    const two = fieldSummaries(farm(37, { 0: arabica, 1: robusta(0), 2: arabica }))
    expect(two[0]).toMatchObject({ variety: 'arabicaStandard', stage: 'wachstum', percent: 30 })
  })
})
