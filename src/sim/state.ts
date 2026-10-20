import type { TimeState } from './time/time'

// Plain JSON game state. Later slices add the fields.
export interface GameState {
  time: TimeState
}

export function createState(): GameState {
  return { time: { hour: 0, speed: 1 } }
}
