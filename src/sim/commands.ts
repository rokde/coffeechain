import { build, type Build } from './buildings/build'
import { care, type Fertilize, type Irrigate } from './farm/care'
import { harvest, type Harvest } from './farm/harvest'
import { createParcels, type CreateParcels } from './farm/parcels'
import { plant, type Plant } from './farm/plants'
import { buy, sell, type Buy, type Sell } from './market/market'
import { deliverOrder, type DeliverOrder } from './market/orders'
import { process, type Process } from './processing/process'
import type { GameState } from './state'
import { setSpeed, type SetSpeed } from './time/time'

// Later slices add their command types to this union.
export type Command =
  | SetSpeed
  | CreateParcels
  | Plant
  | Fertilize
  | Irrigate
  | Harvest
  | Sell
  | Buy
  | Build
  | Process
  | DeliverOrder

type Handlers = {
  [K in Command['type']]: (state: GameState, command: Extract<Command, { type: K }>) => GameState
}

// Later slices register one handler per command type here.
const handlers: Handlers = {
  SetSpeed: setSpeed,
  CreateParcels: createParcels,
  Plant: plant,
  Fertilize: care,
  Irrigate: care,
  Harvest: harvest,
  Sell: sell,
  Buy: buy,
  Build: build,
  Process: process,
  DeliverOrder: deliverOrder,
}

export function dispatch(state: GameState, command: Command): GameState {
  const handler = handlers[command.type] as
    ((state: GameState, command: Command) => GameState) | undefined
  if (!handler) throw new Error(`Unknown command: ${command.type}`)
  return handler(state, command)
}
