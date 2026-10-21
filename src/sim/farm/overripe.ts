import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import { ripeHour, type PlantState } from './plants'

// Share of the yield that a ripe plant still gives at this hour (PRD §6 "Überreife").
export function overripeFactor(plant: PlantState, hour: number, cfg: Balance = balance()): number {
  const { enabled, graceDays, lossPerDay } = cfg.farm.overripe
  if (!enabled) return 1
  const day = cfg.time.ticksPerGameDay
  const lateDays = Math.max(0, Math.floor((hour - ripeHour(plant, cfg)) / day) - graceDays)
  return Math.max(0, 1 - lossPerDay * lateDays)
}
