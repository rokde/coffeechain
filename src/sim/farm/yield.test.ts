import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { mulberry32 } from '../rng'
import { computeYield, yieldRandom, type SoilClass, type Variety } from './yield'

const base = { variety: 'robusta', soilClass: 'gut', zoneMatches: true, fertilized: false } as const

it('gives 20 for Robusta, Gut, matching zone, no fertilizer, random 1', () => {
  expect(computeYield({ ...base, random: 1 })).toBe(20)
})

describe('all varieties and soil classes', () => {
  const varieties: Variety[] = ['robusta', 'arabicaStandard', 'arabicaPremium', 'specialty']
  const soils: SoilClass[] = ['karg', 'mittel', 'gut', 'sehrGut']
  const cfg = balance()
  const pairs = varieties.flatMap((variety) => soils.map((soilClass) => ({ variety, soilClass })))

  it.each(pairs)('$variety on $soilClass', ({ variety, soilClass }) => {
    const expected = Math.floor(cfg.varieties[variety].baseYield * cfg.soil.yieldFactor[soilClass])
    expect(
      computeYield({ variety, soilClass, zoneMatches: true, fertilized: false, random: 1 }),
    ).toBe(expected)
  })

  it.each([
    ['robusta', 'karg', 12],
    ['arabicaStandard', 'mittel', 12],
    ['specialty', 'sehrGut', 4],
  ] as const)('%s on %s gives %i', (variety, soilClass, expected) => {
    expect(computeYield({ variety, soilClass, zoneMatches: true, fertilized: false })).toBe(
      expected,
    )
  })
})

describe('factors', () => {
  it.each([
    ['off-zone parcel', { zoneMatches: false }, 12],
    ['fertilizer', { fertilized: true }, 25],
    ['random 0.9', { random: 0.9 }, 18],
    ['random 1.1', { random: 1.1 }, 22],
    ['event factor 0.7', { eventFactor: 0.7 }, 14],
    ['event factor 0.5 is capped at 0.7', { eventFactor: 0.5 }, 14],
    ['event factor above 1 is not capped', { eventFactor: 1.1 }, 22],
  ])('%s', (_name, extra, expected) => {
    expect(computeYield({ ...base, ...extra })).toBe(expected)
  })

  it('gives the same result for event factor 0.5 and 0.7', () => {
    expect(computeYield({ ...base, eventFactor: 0.5 })).toBe(
      computeYield({ ...base, eventFactor: 0.7 }),
    )
  })
})

it('does not lose a unit to float noise', () => {
  expect(
    computeYield({
      variety: 'specialty',
      soilClass: 'sehrGut',
      zoneMatches: true,
      fertilized: true,
    }),
  ).toBe(6)
})

it('rounds 28.999999999999996 (100 × 0.29) up to 29', () => {
  const cfg = balance()
  const noisy = {
    ...cfg,
    varieties: { ...cfg.varieties, robusta: { ...cfg.varieties.robusta, baseYield: 100 } },
    soil: { ...cfg.soil, yieldFactor: { ...cfg.soil.yieldFactor, gut: 0.29 } },
  }
  expect(computeYield(base, noisy)).toBe(29)
})

it('keeps yieldRandom inside the range and repeats it for the same seed', () => {
  const [min, max] = balance().farm.yieldRandomRange
  const a = mulberry32(7)
  const b = mulberry32(7)
  const draws = Array.from({ length: 1000 }, () => yieldRandom(a))
  expect(draws.every((x) => x >= min && x <= max)).toBe(true)
  expect(draws).toEqual(Array.from({ length: 1000 }, () => yieldRandom(b)))
})
