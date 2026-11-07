import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { cycleSpeed, speedForKey } from './speedKeys'

const speeds = balance().time.speeds

describe('speedForKey', () => {
  it('maps key 0 to pause and keys 1 to 5 to the running speeds in order', () => {
    expect(speedForKey('0', 4, 4, speeds)).toBe(0)
    expect(['1', '2', '3', '4', '5'].map((key) => speedForKey(key, 0, undefined, speeds))).toEqual([
      1, 2, 4, 8, 16,
    ])
  })

  it('pauses with Space at a running speed', () => {
    expect(speedForKey(' ', 8, 8, speeds)).toBe(0)
  })

  it('sets the last running speed with Space at pause, or 1 if there is none', () => {
    expect(speedForKey(' ', 0, 16, speeds)).toBe(16)
    expect(speedForKey(' ', 0, undefined, speeds)).toBe(1)
  })

  it.each(['w', 'q', 'h', '6', '7', 'Enter', ''])('ignores key %j', (key) => {
    expect(speedForKey(key, 1, 1, speeds)).toBeUndefined()
  })
})

describe('cycleSpeed (#42)', () => {
  const speeds = [0, 1, 2, 4, 8, 16]
  it('steps 1 → 2 → 4 → 8 → 16 → 1', () => {
    expect([1, 2, 4, 8, 16].map((s) => cycleSpeed(s, s, speeds))).toEqual([2, 4, 8, 16, 1])
  })
  it('goes on from the last running speed when paused', () => {
    expect(cycleSpeed(0, 4, speeds)).toBe(8)
    expect(cycleSpeed(0, undefined, speeds)).toBe(2)
  })
})
