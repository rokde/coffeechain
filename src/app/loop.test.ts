import { describe, expect, it } from 'vitest'
import { msPerStep, type TimeStage } from '../sim/time/time'
import { advance } from './loop'

const msPerTick = msPerStep('months')
// Uneven frame sizes that are exact in binary floating point, so the sums stay exact.
const frames = [16.75, 33.25, 7.5, 16.5]

// Feeds totalMs in uneven frames and counts the ticks.
function run(totalMs: number, speed: number, carryMs = 0, stage: TimeStage = 'months') {
  let ticks = 0
  let fed = 0
  for (let i = 0; fed < totalMs; i++) {
    const elapsed = Math.min(frames[i % frames.length]!, totalMs - fed)
    fed += elapsed
    const due = advance(carryMs, elapsed, speed, msPerStep(stage))
    ticks += due.ticks
    carryMs = due.carryMs
  }
  return { ticks, carryMs }
}

describe('advance', () => {
  it.each([
    [1, 20_000],
    [2, 10_000],
    [4, 5_000],
    [8, 2_500],
    [16, 1_250],
  ])('AC-5: gives 30 steps (one month) in the months stage at %i× in %i ms', (speed, monthMs) => {
    expect(run(monthMs, speed).ticks).toBe(30)
    expect(run(monthMs - 1, speed).ticks).toBe(29)
  })

  it('AC-5: gives 7 steps (one week) in 20 s in the weeks stage at 1×', () => {
    expect(run(20_000, 1, 0, 'weeks').ticks).toBe(7)
    expect(run(19_999, 1, 0, 'weeks').ticks).toBe(6)
  })

  it('keeps the remainder between frames', () => {
    expect(advance(0, 600, 1, msPerTick)).toEqual({ ticks: 0, carryMs: 600 })
    expect(advance(600, 100, 1, msPerTick).ticks).toBe(1)
  })

  it('caps the ticks per frame at 24 and drops the extra time', () => {
    expect(advance(0, 20_000, 1, msPerTick)).toEqual({ ticks: 24, carryMs: 0 })
    expect(advance(0, 600_000, 1, msPerTick)).toEqual({ ticks: 24, carryMs: 0 })
  })

  it('gives no ticks at pause and releases no stored ticks after it', () => {
    expect(run(1_000_000, 0)).toEqual({ ticks: 0, carryMs: 0 })
    const paused = run(1_000_000, 0, 500)
    expect(paused).toEqual({ ticks: 0, carryMs: 500 })
    expect(advance(paused.carryMs, 1, 1, msPerTick).ticks).toBe(0)
  })
})
