import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import type { GameState } from '../state'
import { cares } from './care'
import { overripeFactor } from './overripe'
import { growth, ripeHour as ripeHourOf, stageAt, type Stage } from './plants'
import type { Variety } from './yield'

export type CareCommand = keyof typeof cares

export interface FieldStatus {
  stage: Stage
  percent: number
  daysToRipe: number | null
  daysToOverripe: number | null
  overripe: boolean
  cares: { fertilized: boolean; irrigated: boolean; pestProtected: boolean }
  open: CareCommand[]
}

// Growth, ripe days and open cares of the plant on a parcel. Null when the parcel has no plant.
export function fieldStatus(
  state: GameState,
  x: number,
  y: number,
  cfg: Balance = balance(),
): FieldStatus | null {
  const plant = state.farm.plants[y * state.world.size + x]
  if (!plant) return null
  const { hour } = state.time
  const day = cfg.time.ticksPerGameDay
  const { progress, stage } = growth(plant, hour, cfg)
  const ripeHour = ripeHourOf(plant, cfg)
  const { enabled, graceDays, lossPerDay } = cfg.farm.overripe
  const overripe = overripeFactor(plant, hour, cfg) < 1
  const ripe = progress >= 1
  const flags = {
    fertilized: plant.fertilized ?? false,
    irrigated: plant.irrigated ?? false,
    pestProtected: plant.pestProtected ?? false,
  }
  return {
    stage,
    percent: Math.floor(progress * 100),
    daysToRipe: ripe ? null : Math.ceil((ripeHour - hour) / day),
    // overripeFactor() drops below 1 at the first full day after the grace days.
    daysToOverripe:
      ripe && !overripe && enabled && lossPerDay > 0
        ? Math.ceil((ripeHour + (graceDays + 1) * day - hour) / day)
        : null,
    overripe,
    cares: flags,
    open: ripe ? [] : (Object.keys(cares) as CareCommand[]).filter((c) => !flags[cares[c].flag]),
  }
}

// True when one plant of the field can still get a care.
export function fieldNeedsCare(state: GameState, fieldId: number): boolean {
  const { size } = state.world
  return Object.entries(state.farm.parcels).some(([index, field]) => {
    if (field !== fieldId) return false
    const i = Number(index)
    return (fieldStatus(state, i % size, Math.floor(i / size))?.open.length ?? 0) > 0
  })
}

export interface FieldSummary {
  id: number
  name: string
  variety: Variety
  parcels: number
  stage: Stage
  percent: number
  state: 'overripe' | 'ripe' | 'care' | null
}

// One row per field with plants, for the field list. The state follows the rule of the message panel.
export function fieldSummaries(state: GameState, cfg: Balance = balance()): FieldSummary[] {
  const { parcels, plants } = state.farm
  const { hour } = state.time
  return state.farm.fields.flatMap(({ id, name }) => {
    const indexes = Object.keys(parcels).filter((i) => parcels[+i] === id)
    const list = indexes.flatMap((i) => plants[+i] ?? [])
    if (list.length === 0) return []
    const count = (v: Variety) => list.filter((p) => p.variety === v).length
    const variety = (Object.keys(cfg.varieties) as Variety[]).reduce((a, b) =>
      count(b) > count(a) ? b : a,
    )
    const progress = list.reduce((sum, p) => sum + growth(p, hour, cfg).progress, 0) / list.length
    const ripe = list.some((p) => growth(p, hour, cfg).progress >= 1)
    const status = list.some((p) => overripeFactor(p, hour, cfg) < 1)
      ? 'overripe'
      : ripe
        ? 'ripe'
        : fieldNeedsCare(state, id)
          ? 'care'
          : null
    return [
      {
        id,
        name,
        variety,
        parcels: indexes.length,
        stage: stageAt(progress, cfg),
        percent: Math.floor(progress * 100),
        state: status,
      },
    ]
  })
}
