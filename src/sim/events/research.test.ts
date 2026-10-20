import { afterEach, describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { createState, type GameState } from '../state'
import { step } from '../time/time'
import { yieldEventFactor } from './effects'
import type { GameEvent } from './schedule'

const cfg = balance().events
const ticks = balance().time.ticksPerGameDay
const { yieldBonus } = cfg.types.research
const maxCount = cfg.researchMaxCount
const DAYS = 1000
const SEED = 11

// The roll day of each new start day: day d is the run at the start of day d.
function run(seed: number): { research: number[]; rolls: number[]; events: GameEvent[][] } {
  let state = createState(seed)
  const rolls: number[] = []
  const events: GameEvent[][] = []
  for (let d = 1; d < DAYS; d++) {
    const before = state.research.length
    for (let h = 0; h < ticks; h++) state = step(state)
    if (state.research.length > before) rolls.push(d + 1)
    expect(state.research.length - before).toBeLessThanOrEqual(1)
    expect(state.research.length).toBeLessThanOrEqual(cfg.researchMaxCount)
    expect(yieldBonus * state.research.length).toBeLessThanOrEqual(cfg.maxEffect + 1e-9)
    events.push(state.events)
  }
  return { research: state.research, rolls, events }
}

// Raises the limit for one test, so that more than one breakthrough can occur.
const allow = (count: number) => (cfg.researchMaxCount = count)

afterEach(() => allow(maxCount))

describe('research breakthroughs', () => {
  it('AC-1: start after the grace days, warningDays after the roll, the same for each seed', () => {
    expect(createState(SEED).research).toEqual([])
    allow(100)
    const { research, rolls } = run(SEED)
    expect(research.length).toBeGreaterThan(1)
    for (const start of research) expect(start).toBeGreaterThan(cfg.graceDaysAtStart)
    expect(research).toEqual(rolls.map((d) => d + cfg.warningDays))
    expect(run(SEED).research).toEqual(research)
  })

  it('AC-2: leave the timed events as without research and stop at maxEffect', () => {
    allow(100)
    const withResearch = run(SEED)
    expect(withResearch.research.length).toBe(Math.round(cfg.maxEffect / yieldBonus))
    allow(0)
    const without = run(SEED)
    expect(without.research).toEqual([])
    expect(withResearch.events).toEqual(without.events)
    for (const day of withResearch.events) {
      for (const e of day) expect(e.type).not.toBe('research')
    }
  })

  it('AC-6: stop at researchMaxCount', () => {
    for (const seed of [1, 2, 3, SEED]) {
      const { research } = run(seed)
      expect(research.length).toBe(maxCount)
    }
  })
})

describe('research yield bonus', () => {
  const hour = 20 * ticks + 5
  const day = 20
  const at = (state: GameState, research: number[]): GameState => ({
    ...state,
    research,
    time: { ...state.time, hour },
  })

  it('AC-3: gives 1 before the start day and the bonus on and after it, for each zone', () => {
    const state = createState(1)
    const zones = new Map(state.world.parcels.map((p, i) => [p.zone, i]))
    for (const i of zones.values()) {
      expect(yieldEventFactor(at(state, []), i, day)).toBe(1)
      expect(yieldEventFactor(at(state, [day + 1]), i, day)).toBe(1)
      expect(yieldEventFactor(at(state, [day]), i, day)).toBeCloseTo(1 + yieldBonus)
      expect(yieldEventFactor(at(state, [day - 5]), i, day)).toBeCloseTo(1 + yieldBonus)
      expect(yieldEventFactor(at(state, [3, day]), i, day)).toBeCloseTo(1 + 2 * yieldBonus)
    }
  })
})
