import { balance } from '../balance'
import type { GameState } from '../state'

export interface TimeState {
  // Game hours since the start. One step adds one hour.
  hour: number
  speed: number
}

export interface SetSpeed {
  type: 'SetSpeed'
  speed: number
}

export function step(state: GameState): GameState {
  return { ...state, time: { ...state.time, hour: state.time.hour + 1 } }
}

export function clock(hour: number): { day: number; hourOfDay: number } {
  const ticksPerDay = balance().time.ticksPerGameDay
  return { day: Math.floor(hour / ticksPerDay) + 1, hourOfDay: hour % ticksPerDay }
}

export function setSpeed(state: GameState, command: SetSpeed): GameState {
  if (!balance().time.speeds.includes(command.speed)) {
    throw new Error(`Invalid speed: ${command.speed}`)
  }
  return { ...state, time: { ...state.time, speed: command.speed } }
}
