import { balance } from './balance'
import type { FarmState } from './farm/parcels'
import type { TimeState } from './time/time'
import { generateWorld } from './world/generate'
import type { World } from './world/types'

// Plain JSON game state. Later slices add the fields.
export interface GameState {
  time: TimeState
  world: World
  // Hundredths of CC.
  money: number
  farm: FarmState
}

export function createState(seed: number): GameState {
  return {
    time: { hour: 0, speed: 1 },
    world: generateWorld(seed, balance()),
    money: Math.round(balance().economy.startCapital * 100),
    farm: { parcels: {}, fields: [], nextFieldId: 0 },
  }
}
