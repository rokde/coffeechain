import { balance } from '../balance'
import type { Balance } from '../../../config/balance.schema'
import type { SoilClass } from './yield'

export interface QualityInput {
  soilClass: SoilClass
  zoneMatches: boolean
  fertilized: boolean
  irrigated: boolean
  // Random points from qualityRandom. The forecast uses the default 0.
  random?: number
}

// Quality points from soil, location, care and chance, before overripeness. All varieties share
// one base: the quality is measured against the variety, whose value is in its price (#21).
// Not rounded or capped, so a pending harvest can keep it and finish it later.
export function baseQuality(input: QualityInput, cfg: Balance = balance()): number {
  const q = cfg.farm.quality
  const { random = 0 } = input
  return (
    q.base +
    q.soilBonus[input.soilClass] -
    (input.zoneMatches ? 0 : q.offZonePenalty) +
    (input.fertilized ? q.fertilizerBonus : 0) +
    (input.irrigated ? q.irrigationBonus : 0) +
    random
  )
}

// Batch quality 0–100 in whole points: overripeness lowers it, the Ernte-Profi milestone raises it.
export function finalQuality(
  base: number,
  overripeFactor: number,
  harvestPro: boolean,
  cfg: Balance = balance(),
): number {
  const ripe = base - cfg.farm.quality.overripePenalty * (1 - overripeFactor)
  const bonus = harvestPro ? 1 + cfg.progression.harvestProQualityBonus : 1
  return Math.min(100, Math.max(0, Math.round(ripe * bonus)))
}

// Maps one PRNG draw in [0, 1) into farm.quality.randomRange.
export function qualityRandom(next: () => number, cfg: Balance = balance()): number {
  const [min, max] = cfg.farm.quality.randomRange
  return min + next() * (max - min)
}
