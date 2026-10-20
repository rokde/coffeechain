import type { GameState } from '../state'

// When a slice adds a state field: increase SAVE_VERSION by one and append one migration
// to MIGRATIONS that fills the default value. Migration i turns version i + 1 into i + 2.
// Never edit an old migration.
export const SAVE_VERSION = 1

export type Migration = (state: Record<string, unknown>) => Record<string, unknown>

export const MIGRATIONS: Migration[] = []

export interface SaveFormat {
  version: number
  migrations: Migration[]
}

export function serialize(state: GameState): string {
  return JSON.stringify({ version: SAVE_VERSION, state })
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// shortcut: no schema check of the state, add one when users can import save files.
export function deserialize(
  text: string,
  format: SaveFormat = { version: SAVE_VERSION, migrations: MIGRATIONS },
): GameState {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Save is not valid JSON')
  }
  if (!isObject(data)) throw new Error('Save has no state object')
  const { version } = data
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error(`Save has an invalid version: ${String(version)}`)
  }
  if (version > format.version) {
    throw new Error(`Save version ${version} is newer than supported version ${format.version}`)
  }
  if (!isObject(data.state)) throw new Error('Save has no state object')
  let state = data.state
  for (const migrate of format.migrations.slice(version - 1, format.version - 1)) {
    state = migrate(state)
  }
  return state as unknown as GameState
}
