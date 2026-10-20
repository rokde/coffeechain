import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import type { GameState } from '../state'
import { overripeFactor } from './overripe'
import { computeYield } from './yield'

// Units that a harvest of this parcel gives now, without the random roll. Null without a plant.
export function forecastYield(
  state: GameState,
  x: number,
  y: number,
  cfg: Balance = balance(),
): number | null {
  const index = y * state.world.size + x
  const plant = state.farm.plants[index]
  const parcel = state.world.parcels[index]
  if (!plant || !parcel) return null
  const factor = overripeFactor(plant, state.time.hour, cfg)
  if (plant.pendingUnits !== undefined) {
    const stored = plant.overripeFactor ?? 1
    return stored > 0 ? Math.floor((plant.pendingUnits * factor) / stored + 1e-9) : 0
  }
  const full = computeYield(
    {
      variety: plant.variety,
      soilClass: parcel.soilClass,
      zoneMatches: parcel.zone === cfg.varieties[plant.variety].zone,
      fertilized: plant.fertilized ?? false,
    },
    cfg,
  )
  return Math.floor(full * factor + 1e-9)
}
