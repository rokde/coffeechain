import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { overripeFactor } from './overripe'
import type { PlantState } from './plants'

const plant: PlantState = { variety: 'robusta', plantedDay: 5 }

function config(enabled: boolean) {
  const cfg = structuredClone(balance())
  cfg.farm.overripe.enabled = enabled
  return cfg
}

const cfg = balance()
const ripeDay = 5 + cfg.varieties.robusta.cycleDays
const { graceDays } = cfg.farm.overripe
const cases: [string, number, number][] = [
  ['an unripe plant', ripeDay - 1, 1],
  ['the ripe day', ripeDay, 1],
  ['the last day of grace', ripeDay + graceDays, 1],
  ['one late day', ripeDay + graceDays + 1, 0.995],
  ['30 late days', ripeDay + graceDays + 30, 0.85],
  ['60 late days', ripeDay + graceDays + 60, 0.7],
  ['300 late days', ripeDay + graceDays + 300, 0],
]

describe('overripeFactor', () => {
  it.each(cases)('AC-1: enabled, gives the factor for %s', (_, day, expected) => {
    const factor = overripeFactor(plant, day, config(true))
    expect(factor).toBeCloseTo(expected, 9)
    expect(factor).toBeGreaterThanOrEqual(0)
  })

  it.each(cases)('AC-2: disabled, gives 1 for %s', (_, day) => {
    expect(overripeFactor(plant, day, config(false))).toBe(1)
  })
})
