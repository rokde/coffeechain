import { describe, expect, it } from 'vitest'
import { dispatch } from '../commands'
import { createState, type GameState } from '../state'
import { clock, step } from './time'

const steps = (n: number) => {
  let state = createState()
  for (let i = 0; i < n; i++) state = step(state)
  return state
}

describe('step', () => {
  it('starts at day 1, 00:00, speed 1', () => {
    const state = createState()
    expect(clock(state.time.hour)).toEqual({ day: 1, hourOfDay: 0 })
    expect(state.time.speed).toBe(1)
  })

  it('adds exactly one game hour', () => {
    expect(step(createState()).time.hour).toBe(1)
    expect(clock(steps(23).time.hour)).toEqual({ day: 1, hourOfDay: 23 })
    expect(clock(steps(24).time.hour)).toEqual({ day: 2, hourOfDay: 0 })
  })
})

describe('SetSpeed', () => {
  it.each([0, 1, 2, 4])('sets speed %i', (speed) => {
    const state = createState()
    const before = structuredClone(state)
    expect(dispatch(state, { type: 'SetSpeed', speed }).time.speed).toBe(speed)
    expect(state).toEqual(before)
  })

  it.each([3, -1, 0.5, 8, NaN])('throws for speed %s', (speed) => {
    const state: GameState = createState()
    const before = structuredClone(state)
    expect(() => dispatch(state, { type: 'SetSpeed', speed })).toThrow()
    expect(state).toEqual(before)
  })
})
