import { care, type Fertilize, type Irrigate, type ProtectPests } from './farm/care'
import { harvest, type Harvest } from './farm/harvest'
import { createParcels, type CreateParcels } from './farm/parcels'
import { plant, type Plant } from './farm/plants'
import type { GameState } from './state'
import { setSpeed, type SetSpeed } from './time/time'

// Later slices add their command types to this union.
export type Command =
  SetSpeed | CreateParcels | Plant | Fertilize | Irrigate | ProtectPests | Harvest

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
  ProtectPests: care,
  Harvest: harvest,
}

export function dispatch(state: GameState, command: Command): GameState {
  const handler = handlers[command.type] as
    ((state: GameState, command: Command) => GameState) | undefined
  if (!handler) throw new Error(`Unknown command: ${command.type}`)
  return handler(state, command)
}
