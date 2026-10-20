import type { GameState } from './state'

export interface Command {
  type: string
}

type Handler = (state: GameState, command: Command) => GameState

// Later slices register one handler per command type here.
const handlers: Partial<Record<string, Handler>> = {}

export function dispatch(state: GameState, command: Command): GameState {
  const handler = handlers[command.type]
  if (!handler) throw new Error(`Unknown command: ${command.type}`)
  return handler(state, command)
}
