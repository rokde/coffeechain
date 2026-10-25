import { balance } from './balance'
import type { BuildingKind } from './buildings/build'
import type { FarmState } from './farm/parcels'
import type { MarketState } from './market/market'
import type { OrdersState } from './market/orders'
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
  // Hundredths of CC that the player paid for parcels and buildings.
  invested: number
  farm: FarmState
  // Parcel index → building on it.
  buildings: Record<number, { kind: BuildingKind }>
  storage: StorageState
  market: MarketState
  orders: OrdersState
  milestones: { harvested: number; harvestProDay?: number }
}

export function createState(seed: number): GameState {
  const world = generateWorld(seed, balance())
  return {
    time: { day: 0, speed: 1, stage: 'months' },
    world,
    props: placeProps(world, balance()),
    money: Math.round(balance().economy.startCapital * 100),
    invested: 0,
    farm: { parcels: {}, fields: [], nextFieldId: 0, plants: {} },
    buildings: {},
    storage: { batches: [] },
    market: { volumes: [], seeds: {} },
    orders: { open: [], nextId: 0 },
    milestones: { harvested: 0 },
  }
}
