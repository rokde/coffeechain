import { expect, it } from 'vitest'
import { mulberry32 } from './rng'

it('gives the same sequence for the same seed', () => {
  const a = mulberry32(42)
  const b = mulberry32(42)
  const seq = Array.from({ length: 100 }, () => a())
  expect(seq).toEqual(Array.from({ length: 100 }, () => b()))
  expect(seq.every((x) => x >= 0 && x < 1)).toBe(true)
  expect(mulberry32(43)()).not.toBe(seq[0])
})
