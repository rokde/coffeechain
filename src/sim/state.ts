import { balance } from './balance'
import type { TimeState } from './time/time'
import { generateWorld } from './world/generate'
import type { World } from './world/types'

// Plain JSON game state. Later slices add the fields.
export interface GameState {
  time: TimeState
  world: World
}

export function createState(seed: number): GameState {
  return { time: { hour: 0, speed: 1 }, world: generateWorld(seed, balance()) }
}
