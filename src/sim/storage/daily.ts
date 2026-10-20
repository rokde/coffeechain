import { balance } from '../balance'
import type { GameState } from '../state'
import { soilClassOf } from '../world/generate'
import { storageUsed } from './storage'

// Applies the storage cost, the quality loss and the fallow recovery for one game day.
export function dailyUpkeep(state: GameState): GameState {
  const cfg = balance()
  const cost = Math.round(storageUsed(state.storage) * cfg.storage.costPerUnitPerDay * 100)
  const loss = cfg.storage.qualityLossPerDayRaw
  const batches = state.storage.batches.map((batch) => ({
    ...batch,
    quality: Math.max(0, batch.quality - loss),
  }))
  const parcels = [...state.world.parcels]
  for (const key of Object.keys(state.farm.parcels)) {
    const index = Number(key)
    if (index in state.farm.plants) continue
    const parcel = parcels[index]!
    const fertility = Math.min(100, parcel.fertility + cfg.soil.fertilityRecoveryPerFallowDay)
    const soilQuality = (fertility + parcel.waterRetention) / 200
    const soilClass = soilClassOf(soilQuality, cfg.soil.classMinQuality)
    parcels[index] = { ...parcel, fertility, soilQuality, soilClass }
  }
  return {
    ...state,
    money: state.money - cost,
    world: { ...state.world, parcels },
    storage: { ...state.storage, batches },
  }
}
