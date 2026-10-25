import { describe, expect, it } from 'vitest'
import raw from '../../../config/balance.json'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import type { Command } from '../commands'
import { calendar, msPerStep, step, type TimeStage } from './time'

const steps = (n: number) => {
  let state = createState(1)
  for (let i = 0; i < n; i++) state = step(state)
  return state
}

describe('step', () => {
  it('starts on day 0 in the months stage at speed 1', () => {
    const state = createState(1)
    expect(state.time).toEqual({ day: 0, speed: 1, stage: 'months' })
  })

  it('AC-2: adds exactly one calendar day', () => {
    expect(step(createState(1)).time.day).toBe(1)
    expect(steps(29).time.day).toBe(29)
    expect(steps(30).time.day).toBe(30)
  })
})

describe('time stage (#27)', () => {
  // Plays 400 steps with the same commands. The stage changes only the real time per step.
  function play(stage: TimeStage): GameState {
    const start = createState(7)
    let state: GameState = { ...start, time: { ...start.time, stage } }
    const [a, b] = state.world.parcels
      .filter(
        (p) => p.zone === 'tiefland' && !(state.world.parcels.indexOf(p) in state.farm.parcels),
      )
      .slice(0, 2)
      .map(({ x, y }) => ({ x, y }))
    const commands: Record<number, Command> = {
      0: { type: 'CreateParcels', parcels: [a!, b!] },
      1: { type: 'Plant', variety: 'robusta', parcels: [a!, b!] },
      95: { type: 'Harvest', parcels: [a!, b!] },
      100: { type: 'Sell', variety: 'robusta', units: 5 },
    }
    for (let i = 0; i < 400; i++) {
      const command = commands[i]
      if (command) state = dispatch(state, command)
      state = step(state)
    }
    return state
  }

  it('AC-5: the same seed and commands give the same state in months and weeks', () => {
    const months = play('months')
    const weeks = play('weeks')
    expect(months.time.stage).toBe('months')
    expect(weeks.time.stage).toBe('weeks')
    expect({ ...weeks, time: { ...weeks.time, stage: 'months' } }).toEqual(months)
    expect(months.milestones.harvested).toBeGreaterThan(0)
    expect(months.time.day).toBe(400)
  })

  it('AC-5: one step takes 20 s / 30 in months and 20 s / 7 in weeks', () => {
    expect(msPerStep('months') * 30).toBeCloseTo(20000, 9)
    expect(msPerStep('weeks') * 7).toBeCloseTo(20000, 9)
  })
})

describe('weeks stage from phase 2 (085)', () => {
  const withMoney = (money: number): GameState => ({ ...createState(1), money })

  it('AC-1: stays in months below 2,000 CC and switches at 2,000 CC', () => {
    expect(balance().time.weeksFromPhase).toBe(2)
    expect(raw.time.weeksFromPhase.src).toBe('NEU')
    const below = step(withMoney(199_999))
    expect(below.time.stage).toBe('months')
    expect(below.time.weeksFromDay).toBeUndefined()
    const at = step(withMoney(200_000))
    expect(at.time).toMatchObject({ day: 1, stage: 'weeks', weeksFromDay: 1 })
  })

  it('AC-2: never switches back when the capital falls below 2,000 CC', () => {
    let state: GameState = { ...step(withMoney(200_000)), money: 0 }
    for (let i = 0; i < 100; i++) {
      state = step(state)
      expect(state.time.stage).toBe('weeks')
      expect(state.time.weeksFromDay).toBe(1)
    }
    expect(state.time.day).toBe(101)
  })
})

describe('calendar', () => {
  it.each([
    [0, { dayOfMonth: 1, month: 1, year: 1 }],
    [29, { dayOfMonth: 30, month: 1, year: 1 }],
    [30, { dayOfMonth: 1, month: 2, year: 1 }],
    [359, { dayOfMonth: 30, month: 12, year: 1 }],
    [360, { dayOfMonth: 1, month: 1, year: 2 }],
    [431, { dayOfMonth: 12, month: 3, year: 2 }],
  ])('AC-1: day %i rolls over to %o', (day, date) => {
    expect(calendar(day)).toEqual(date)
  })

  it('uses 12 months of 30 days with src NEU', () => {
    expect(balance().time.daysPerMonth).toBe(30)
    expect(balance().time.monthsPerYear).toBe(12)
    expect(raw.time.daysPerMonth.src).toBe('NEU')
    expect(raw.time.monthsPerYear.src).toBe('NEU')
  })
})

describe('SetSpeed', () => {
  it('uses the speeds that Robert set', () => {
    expect(balance().time.speeds).toEqual([0, 1, 2, 4, 8, 16])
    expect(raw.time.speeds.src).toBe('Robert 2026-10-20')
  })

  it.each([0, 1, 2, 4, 8, 16])('sets speed %i', (speed) => {
    const state = createState(1)
    const before = structuredClone(state)
    expect(dispatch(state, { type: 'SetSpeed', speed }).time.speed).toBe(speed)
    expect(state).toEqual(before)
  })

  it.each([3, 32, -1, 0.5, NaN])('throws for speed %s', (speed) => {
    const state: GameState = createState(1)
    const before = structuredClone(state)
    expect(() => dispatch(state, { type: 'SetSpeed', speed })).toThrow()
    expect(state).toEqual(before)
  })
})
