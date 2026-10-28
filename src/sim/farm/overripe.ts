import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import { ripeDay, type PlantState } from './plants'

// Share of the yield that a ripe plant still gives on this day (PRD §6 "Überreife").
export function overripeFactor(plant: PlantState, day: number, cfg: Balance = balance()): number {
  const { enabled, graceDays, lossPerDay } = cfg.farm.overripe
  if (!enabled) return 1
  const lateDays = Math.max(0, Math.floor(day - ripeDay(plant, cfg)) - graceDays)
  return Math.max(0, 1 - lossPerDay * lateDays)
}
