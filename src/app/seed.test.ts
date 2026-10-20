import { describe, expect, it } from 'vitest'
import { pickSeed } from './seed'

describe('pickSeed', () => {
  it.each([
    ['?seed=48213', 48213],
    ['?seed=0', 0],
    ['?seed=4294967295', 4294967295],
    ['?a=1&seed=7', 7],
  ])('reads %s', (search, seed) => {
    expect(pickSeed(search)).toBe(seed)
  })

  it.each(['', '?seed=', '?seed=-1', '?seed=1.5', '?seed=4294967296', '?seed=abc', '?seed=1e3'])(
    'picks a random seed in range for "%s"',
    (search) => {
      const seed = pickSeed(search)
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThanOrEqual(0xffffffff)
    },
  )
})
