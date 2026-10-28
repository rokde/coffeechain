import type { GameState } from '../state'
import { roundIncome } from '../money'
import { gameStateSchema } from './schema'

// When a slice adds a state field: increase SAVE_VERSION by one and append one migration
// to MIGRATIONS that fills the default value. Migration i turns version i + 1 into i + 2.
// Never edit an old migration.
export const SAVE_VERSION = 13
// #17 removes the volcano zone without a migration (Robert 2026-10-25), so older saves do not load.
export const MIN_SAVE_VERSION = 11

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
  // 7 -> 8: S57 books whole CC only. deserialize floors money and invested on every load.
  (state) => state,
  // 8 -> 9: #8 removes the events, the research breakthroughs and the growth delay.
  (state) => {
    const next = { ...state }
    delete next.events
    delete next.research
    const farm = next.farm as { plants?: Record<string, Record<string, unknown>> } | undefined
    if (!farm?.plants) return next
    const plants = Object.fromEntries(
      Object.entries(farm.plants).map(([k, plant]) => {
        const copy = { ...plant }
        delete copy.growthDelayHours
        return [k, copy]
      }),
    )
    return { ...next, farm: { ...farm, plants } }
  },
  // 9 -> 10: #8 removes the pest protection.
  (state) => {
    const farm = state.farm as { plants?: Record<string, Record<string, unknown>> } | undefined
    if (!farm?.plants) return state
    const plants = Object.fromEntries(
      Object.entries(farm.plants).map(([k, plant]) => {
        const copy = { ...plant }
        delete copy.pestProtected
        return [k, copy]
      }),
    )
    return { ...state, farm: { ...farm, plants } }
  },
  // 10 -> 11: #17 removes the volcano zone. MIN_SAVE_VERSION rejects the older saves.
  (state) => state,
  // 11 -> 12: #27 steps in calendar days. One old game day (24 hours) becomes one month (30 days).
  (state) => {
    const day = (hour: unknown) => (typeof hour === 'number' ? Math.floor((hour * 30) / 24) : hour)
    // Old day numbers start at 1. New days start at 0.
    const fromOldDay = (d: unknown) => (typeof d === 'number' ? (d - 1) * 30 : d)
    type Obj = Record<string, unknown>
    const { hour, ...time } = (state.time ?? {}) as Obj
    const farm = state.farm as { plants?: Record<string, Obj> } | undefined
    const plants =
      farm?.plants &&
      Object.fromEntries(
        Object.entries(farm.plants).map(([k, { plantedHour, ...plant }]) => [
          k,
          { ...plant, plantedDay: day(plantedHour) },
        ]),
      )
    const storage = state.storage as { batches?: Obj[] } | undefined
    const batches = storage?.batches?.map(({ readyHour, ...b }) =>
      readyHour === undefined ? b : { ...b, readyDay: day(readyHour) },
    )
    const market = state.market as { volumes?: Obj[] } | undefined
    const volumes = market?.volumes?.map((v) => ({ ...v, day: fromOldDay(v.day) }))
    const orders = state.orders as { open?: Obj[] } | undefined
    const open = orders?.open?.map((o) => ({ ...o, deadlineDay: fromOldDay(o.deadlineDay) }))
    const { harvestProHour, ...milestones } = (state.milestones ?? {}) as Obj
    return {
      ...state,
      time: { ...time, day: day(hour), stage: 'months' },
      ...(farm && { farm: { ...farm, plants } }),
      ...(storage && { storage: { ...storage, batches } }),
      ...(market && { market: { ...market, volumes } }),
      ...(orders && { orders: { ...orders, open } }),
      milestones:
        harvestProHour === undefined
          ? milestones
          : { ...milestones, harvestProDay: day(harvestProHour) },
    }
  },
  // 12 -> 13: #3 adds savedAt to the envelope, not to the state. An older save has no savedAt.
  (state) => state,
]

export interface SaveFormat {
  version: number
  minVersion: number
  migrations: Migration[]
}

// savedAt: epoch milliseconds. The caller gives the time, so the sim reads no clock.
export function serialize(state: GameState, savedAt: number): string {
  return JSON.stringify({ version: SAVE_VERSION, savedAt, state })
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const CURRENT: SaveFormat = {
  version: SAVE_VERSION,
  minVersion: MIN_SAVE_VERSION,
  migrations: MIGRATIONS,
}

export const deserialize = (text: string, format: SaveFormat = CURRENT): GameState =>
  readSave(text, format).state

// savedAt is null when the save has no valid time.
export function readSave(
  text: string,
  format: SaveFormat = CURRENT,
): { state: GameState; savedAt: number | null } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Save is not valid JSON')
  }
  if (!isObject(data)) throw new Error('Save has no state object')
  const { version } = data
  if (typeof version !== 'number' || !Number.isInteger(version) || version < format.minVersion) {
    throw new Error(`Save has an unknown or old version: ${String(version)}`)
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
  // Floor, so a save with fractions loads as whole CC and the rounding never gives money.
  const { money, invested } = result.data
  const { savedAt } = data
  return {
    state: { ...result.data, money: roundIncome(money), invested: roundIncome(invested) },
    savedAt:
      typeof savedAt === 'number' && Number.isFinite(savedAt) && savedAt >= 0 ? savedAt : null,
  }
}
