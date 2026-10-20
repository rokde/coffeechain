import { describe, expect, it } from 'vitest'
import { fpsFromFrames } from './fps'

describe('fpsFromFrames (S54)', () => {
  it('AC-4: gives 60 for 16.67 ms and 30 for 33.3 ms frames', () => {
    expect(fpsFromFrames(Array(60).fill(16.67))).toBe(60)
    expect(fpsFromFrames(Array(60).fill(33.3))).toBe(30)
    expect(fpsFromFrames([10, 30])).toBe(50)
  })

  it('AC-4: ignores frame times of 0', () => {
    expect(fpsFromFrames([0, 16.67, 0, 16.67])).toBe(60)
    expect(fpsFromFrames([0])).toBe(0)
    expect(fpsFromFrames([])).toBe(0)
  })
})
