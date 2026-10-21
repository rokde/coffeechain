import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import type { GameEvent } from '../events/schedule'
import { createState, type GameState } from '../state'
import { step } from '../time/time'
import type { Parcel, Zone } from '../world/types'
import { overripeFactor } from './overripe'
import { growth, ripeHour, type PlantState } from './plants'
import { fieldStatus } from './status'

const cfg = balance()
const ticks = cfg.time.ticksPerGameDay
const { graceDays } = cfg.farm.overripe

// Parcel 0 is Tiefland, parcel 1 is Hochland. A monsoon of monsoonDays starts on day 1, hour 0.
// The runs stay before day 5, so dailyEvents announces no new event (graceDaysAtStart).
function testState(monsoonDays: number, plantedHour = 0): GameState {
  const state = createState(1)
  const zones: Zone[] = ['tiefland', 'hochland']
  const parcels: Parcel[] = zones.map((zone, x) => ({
    x,
    y: 0,
    height: 0.3,
    zone,
    fertility: 50,
    waterRetention: 50,
    soilQuality: 0.5,
    soilClass: 'gut',
  }))
  const plants: Record<number, PlantState> = {
    0: { variety: 'robusta', plantedHour },
    1: { variety: 'robusta', plantedHour },
  }
  const events: GameEvent[] =
    monsoonDays > 0
      ? [{ type: 'monsoon', announcedDay: 0, startDay: 1, endDay: 1 + monsoonDays }]
      : []
  return {
    ...state,
    world: { seed: 1, size: 2, parcels, start: { x: 0, y: 0 } },
    farm: { ...state.farm, parcels: { 0: 0, 1: 0 }, plants },
    events,
  }
}

const steps = (start: GameState, n: number) => {
  let state = start
  for (let i = 0; i < n; i++) state = step(state)
  return state
}

const growthOf = (state: GameState, index: number) =>
  growth(state.farm.plants[index]!, state.time.hour)

describe('monsoon cycle time (S51c)', () => {
  it('AC-2: Tiefland Robusta ripens after 94 monsoon steps, Hochland after 72', () => {
    expect(cfg.varieties.robusta.cycleDays).toBe(3)
    expect(ticks).toBe(24)
    const start = testState(7)
    const at93 = steps(start, 93)
    expect(at93.events).toEqual(start.events)
    expect(growthOf(at93, 0).progress).toBeLessThan(1)
    const at94 = step(at93)
    expect(growthOf(at94, 0)).toEqual({ progress: 1, stage: 'reif' })
    expect(growthOf(steps(start, 71), 1).progress).toBeLessThan(1)
    expect(growthOf(steps(start, 72), 1).stage).toBe('reif')
    expect(steps(start, 72).farm.plants[1]!.growthDelayHours).toBeUndefined()
  })

  it('AC-3: a running plant slows only while the monsoon lasts', () => {
    const start = testState(1)
    const after = steps(start, ticks)
    const delay = after.farm.plants[0]!.growthDelayHours!
    expect(delay).toBeCloseTo(24 * (1 - 1 / 1.3))
    expect(steps(after, 10).farm.plants[0]!.growthDelayHours).toBe(delay)
    expect(growthOf(steps(start, 77), 0).progress).toBeLessThan(1)
    expect(growthOf(steps(start, 78), 0).stage).toBe('reif')

    const plant = after.farm.plants[0]!
    const late = ripeHour(plant)
    expect(late).toBeCloseTo(72 + delay)
    expect(fieldStatus(after, 0, 0)!.daysToRipe).toBe(Math.ceil((late - after.time.hour) / ticks))
    expect(fieldStatus(after, 0, 0)!.daysToRipe).toBe(3)
    expect(fieldStatus(after, 1, 0)!.daysToRipe).toBe(2)
    const overripeHour = 72 + (graceDays + 1) * ticks
    expect(overripeFactor({ ...plant, growthDelayHours: 0 }, overripeHour)).toBeLessThan(1)
    expect(overripeFactor(plant, overripeHour)).toBe(1)
    expect(overripeFactor(plant, Math.ceil(late) + (graceDays + 1) * ticks)).toBeLessThan(1)
  })

  it('AC-4: a plant that is ripe before the monsoon gets no delay', () => {
    const planted = -80
    const monsoon = steps(testState(7, planted), 90)
    const dry = steps(testState(0, planted), 90)
    expect(monsoon.farm.plants[0]!.growthDelayHours).toBeUndefined()
    expect(monsoon.farm.plants[0]).toEqual(dry.farm.plants[0])
    const hour = monsoon.time.hour
    expect(overripeFactor(monsoon.farm.plants[0]!, hour)).toBe(
      overripeFactor(dry.farm.plants[0]!, hour),
    )
    expect(overripeFactor(monsoon.farm.plants[0]!, hour)).toBeLessThan(1)
  })
})
