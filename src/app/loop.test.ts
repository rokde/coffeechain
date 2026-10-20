import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { advance } from './loop'

const { realSecondsPerGameDay, ticksPerGameDay } = balance().time
const msPerTick = (realSecondsPerGameDay * 1000) / ticksPerGameDay
// Uneven frame sizes that are exact in binary floating point, so the sums stay exact.
const frames = [16.75, 33.25, 7.5, 16.5]

// Feeds totalMs in uneven frames and counts the ticks.
function run(totalMs: number, speed: number, carryMs = 0) {
  let ticks = 0
  let fed = 0
  for (let i = 0; fed < totalMs; i++) {
    const elapsed = Math.min(frames[i % frames.length]!, totalMs - fed)
    fed += elapsed
    const due = advance(carryMs, elapsed, speed, msPerTick)
    ticks += due.ticks
    carryMs = due.carryMs
  }
  return { ticks, carryMs }
}

describe('advance', () => {
  it.each([
    [1, 240_000],
    [2, 120_000],
    [4, 60_000],
    [8, 30_000],
    [16, 15_000],
  ])('gives 24 ticks per game day at %i×', (speed, dayMs) => {
    expect(run(dayMs, speed)).toEqual({ ticks: 24, carryMs: 0 })
    expect(run(dayMs - 1, speed).ticks).toBe(23)
  })

  it('keeps the remainder between frames', () => {
    expect(advance(0, 9_999, 1, msPerTick)).toEqual({ ticks: 0, carryMs: 9_999 })
    expect(advance(9_999, 1, 1, msPerTick)).toEqual({ ticks: 1, carryMs: 0 })
  })

  it('caps the ticks per frame at 24 and drops the extra time', () => {
    expect(advance(0, 240_000, 1, msPerTick)).toEqual({ ticks: 24, carryMs: 0 })
    expect(advance(5_000, 240_000, 1, msPerTick)).toEqual({ ticks: 24, carryMs: 5_000 })
    expect(advance(0, 600_000, 1, msPerTick)).toEqual({ ticks: 24, carryMs: 0 })
  })

  it('gives no ticks at pause and releases no stored ticks after it', () => {
    expect(run(1_000_000, 0)).toEqual({ ticks: 0, carryMs: 0 })
    const paused = run(1_000_000, 0, 5_000)
    expect(paused).toEqual({ ticks: 0, carryMs: 5_000 })
    expect(advance(paused.carryMs, 1, 1, msPerTick).ticks).toBe(0)
  })
})
