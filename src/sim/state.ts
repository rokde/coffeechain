// Plain JSON game state. Later slices add the fields.
export type GameState = Record<string, never>

export function createState(): GameState {
  return {}
}
