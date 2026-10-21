import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import type { GameState } from '../state'
import { cares } from './care'
import { overripeFactor } from './overripe'
import { growth, ripeHour as ripeHourOf, type Stage } from './plants'

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
