import { balance } from './balance'
import type { GameEvent } from './events/schedule'
import type { FarmState } from './farm/parcels'
import type { MarketState } from './market/market'
import type { StorageState } from './storage/storage'
import type { TimeState } from './time/time'
import { generateWorld } from './world/generate'
import { placeProps, type WorldProps } from './world/props'
import type { World } from './world/types'

// Plain JSON game state. Later slices add the fields.
export interface GameState {
  time: TimeState
  world: World
  props: WorldProps
  // Hundredths of CC.
  money: number
  farm: FarmState
  storage: StorageState
  market: MarketState
  events: GameEvent[]
  milestones: { harvested: number; harvestProHour?: number }
}

export function createState(seed: number): GameState {
  const world = generateWorld(seed, balance())
  return {
    time: { hour: 0, speed: 1 },
    world,
    props: placeProps(world, balance()),
    money: Math.round(balance().economy.startCapital * 100),
    farm: { parcels: {}, fields: [], nextFieldId: 0, plants: {} },
    storage: { batches: [] },
    market: { volumes: [], seeds: {} },
    events: [],
    milestones: { harvested: 0 },
  }
}
