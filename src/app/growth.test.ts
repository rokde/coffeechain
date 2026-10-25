import { describe, expect, it } from 'vitest'
import { growth } from '../sim/farm/plants'
import { createState } from '../sim/state'
import { msPerStep, step } from '../sim/time/time'
import { advance } from './loop'

const msPerTick = msPerStep('months')
// Frames that are exact in binary floating point, so the sums stay exact.
const frames = [16.75, 33.25, 7.5, 16.5]

// Runs real time through advance and step, then gives the stage of a Robusta planted on day 0.
function stageAfter(totalMs: number, speed: number) {
  let state = createState(1)
  const plant = { variety: 'robusta', plantedDay: state.time.day } as const
  let carryMs = 0
  for (let i = 0, fed = 0; fed < totalMs; i++) {
    const elapsed = Math.min(frames[i % frames.length]!, totalMs - fed)
    fed += elapsed
    const due = advance(carryMs, elapsed, speed, msPerTick)
    carryMs = due.carryMs
    for (let t = 0; t < due.ticks; t++) state = step(state)
  }
  return growth(plant, state.time.day).stage
}

describe('Robusta growth in real time', () => {
  it.each([
    [1, 60_000],
    [4, 15_000],
    [16, 3_750],
  ])('AC-5: at %i× it is ripe after %i ms', (speed, ms) => {
    expect(stageAfter(ms - 1, speed)).not.toBe('reif')
    expect(stageAfter(ms, speed)).toBe('reif')
  })
})
