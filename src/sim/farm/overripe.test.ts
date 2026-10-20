import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { overripeFactor } from './overripe'
import type { PlantState } from './plants'

const plant: PlantState = { variety: 'robusta', plantedHour: 5 }

function config(enabled: boolean) {
  const cfg = structuredClone(balance())
  cfg.farm.overripe.enabled = enabled
  return cfg
}

const cfg = balance()
const day = cfg.time.ticksPerGameDay
const ripeHour = 5 + cfg.varieties.robusta.cycleDays * day
const { graceDays } = cfg.farm.overripe
const lateHour = ripeHour + (graceDays + 1) * day
const cases: [string, number, number][] = [
  ['an unripe plant', ripeHour - 1, 1],
  ['the ripe hour', ripeHour, 1],
  ['the last hour of grace', ripeHour + graceDays * day + 23, 1],
  ['one late day', lateHour, 0.85],
  ['two late days', lateHour + day, 0.7],
  ['ten more days', lateHour + 10 * day, 0],
]

describe('overripeFactor', () => {
  it.each(cases)('AC-1: enabled, gives the factor for %s', (_, hour, expected) => {
    const factor = overripeFactor(plant, hour, config(true))
    expect(factor).toBeCloseTo(expected, 9)
    expect(factor).toBeGreaterThanOrEqual(0)
  })

  it.each(cases)('AC-2: disabled, gives 1 for %s', (_, hour) => {
    expect(overripeFactor(plant, hour, config(false))).toBe(1)
  })
})
