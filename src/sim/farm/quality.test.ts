import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { mulberry32 } from '../rng'
import { baseQuality, finalQuality, qualityRandom } from './quality'
import type { SoilClass } from './yield'

const base = {
  soilClass: 'gut',
  zoneMatches: true,
  fertilized: false,
  irrigated: false,
} as const

it('gives 72 for Gut, matching zone, no care, random 0', () => {
  expect(baseQuality({ ...base, random: 0 })).toBe(72)
})

describe('soil classes', () => {
  const { quality } = balance().farm
  const soils: SoilClass[] = ['karg', 'mittel', 'gut', 'sehrGut']

  it.each(soils)('%s', (soilClass) => {
    expect(baseQuality({ ...base, soilClass })).toBe(quality.base + quality.soilBonus[soilClass])
  })

  it.each([
    ['karg', 60],
    ['mittel', 67],
    ['sehrGut', 75],
  ] as const)('%s gives %i', (soilClass, expected) => {
    expect(baseQuality({ ...base, soilClass })).toBe(expected)
  })
})

describe('factors', () => {
  it.each([
    ['off-zone parcel', { zoneMatches: false }, 62],
    ['fertilizer', { fertilized: true }, 75],
    ['irrigation', { irrigated: true }, 77],
    ['both care measures', { fertilized: true, irrigated: true }, 80],
    ['random -5', { random: -5 }, 67],
    ['random +5', { random: 5 }, 77],
  ] as const)('%s', (_, change, expected) => {
    expect(baseQuality({ ...base, ...change })).toBe(expected)
  })
})

describe('finalQuality', () => {
  it.each([
    ['no overripeness, no milestone', 62, 1, false, 62],
    ['rounds to whole points', 62.4, 1, false, 62],
    ['overripe factor 0.85 costs 6 points', 62, 0.85, false, 56],
    ['fully overripe costs 40 points', 62, 0, false, 22],
    ['milestone adds 5 %', 80, 1, true, 84],
    ['milestone stays at the cap', 98, 1, true, 100],
    ['never above 100', 112, 1, false, 100],
    ['never below 0', -20, 1, false, 0],
  ] as const)('%s', (_, raw, factor, harvestPro, expected) => {
    expect(finalQuality(raw, factor, harvestPro)).toBe(expected)
  })
})

describe('qualityRandom', () => {
  it('maps 0 and almost 1 onto the range', () => {
    const [min, max] = balance().farm.quality.randomRange
    expect(qualityRandom(() => 0)).toBe(min)
    expect(qualityRandom(() => 0.999999)).toBeCloseTo(max, 4)
  })

  it('gives the same value for the same seed', () => {
    const a = qualityRandom(mulberry32(42))
    const b = qualityRandom(mulberry32(42))
    expect(a).toBe(b)
    expect(qualityRandom(mulberry32(43))).not.toBe(a)
  })
})
