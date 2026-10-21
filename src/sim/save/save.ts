import type { GameState } from '../state'
import { gameStateSchema } from './schema'

// When a slice adds a state field: increase SAVE_VERSION by one and append one migration
// to MIGRATIONS that fills the default value. Migration i turns version i + 1 into i + 2.
// Never edit an old migration.
export const SAVE_VERSION = 7

export type Migration = (state: Record<string, unknown>) => Record<string, unknown>

export const MIGRATIONS: Migration[] = [
  // 1 -> 2: S50 adds the event list.
  (state) => ({ ...state, events: [] }),
  // 2 -> 3: S49 adds the milestones.
  (state) => ({ ...state, milestones: { harvested: 0 } }),
  // 3 -> 4: S51b adds the research breakthroughs.
  (state) => ({ ...state, research: [] }),
  // 4 -> 5: S44 adds the buildings.
  (state) => ({ ...state, buildings: {} }),
  // 5 -> 6: S47 adds the invested capital.
  // shortcut: old saves have no paid prices, so invested starts at 0; no upgrade path, the prices are lost.
  (state) => ({ ...state, invested: 0 }),
  // 6 -> 7: S56 adds the buyer orders.
  (state) => ({ ...state, orders: { open: [], nextId: 0 } }),
]

export interface SaveFormat {
  version: number
  migrations: Migration[]
}

export function serialize(state: GameState): string {
  return JSON.stringify({ version: SAVE_VERSION, state })
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
  const result = gameStateSchema.safeParse(state)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || 'state'}: ${i.message}`)
    throw new Error(`Save state is invalid: ${issues.join('; ')}`)
  }
  return result.data
}
