import { balance } from '../balance'
import type { Balance } from '../../../config/balance.schema'

export type Variety = keyof Balance['varieties']
export type SoilClass = keyof Balance['soil']['yieldFactor']

export interface YieldInput {
  variety: Variety
  soilClass: SoilClass
  zoneMatches: boolean
  fertilized: boolean
  // Product of all event multipliers. The floor is 1 − events.maxEffect.
  eventFactor?: number
  // Random multiplier from yieldRandom. The forecast uses the default 1.
  random?: number
}

// Harvest amount in whole units (PRD §6 "Ertrag").
export function computeYield(input: YieldInput, cfg: Balance = balance()): number {
  const { eventFactor = 1, random = 1 } = input
  const amount =
    cfg.varieties[input.variety].baseYield *
    cfg.soil.yieldFactor[input.soilClass] *
    (input.zoneMatches ? 1 : cfg.world.offZoneYieldFactor) *
    (input.fertilized ? 1 + cfg.farm.fertilizerYieldBonus : 1) *
    Math.max(eventFactor, 1 - cfg.events.maxEffect) *
    random
  // The epsilon stops float noise (e.g. 5.9999…) from losing a whole unit.
  return Math.floor(amount + 1e-9)
}

// Maps one PRNG draw in [0, 1) into farm.yieldRandomRange.
export function yieldRandom(next: () => number, cfg: Balance = balance()): number {
  const [min, max] = cfg.farm.yieldRandomRange
  return min + next() * (max - min)
}
