import { balance } from '../balance'
import { mulberry32 } from '../rng'
import type { GameState } from '../state'
import { storageCapacity } from '../storage/capacity'
import { storageUsed, type Batch } from '../storage/storage'
import { soilClassOf } from '../world/generate'
import { overripeFactor } from './overripe'
import { growth } from './plants'
import { baseQuality, finalQuality, qualityRandom } from './quality'
import { computeYield, yieldRandom } from './yield'

export interface Harvest {
  type: 'Harvest'
  parcels: { x: number; y: number }[]
}

// Seeds the yield and quality rolls from the world seed, the day and the parcel, so the state needs no PRNG.
export function harvestSeed(seed: number, day: number, index: number): number {
  return (seed ^ Math.imul(day + 1, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0
}

export function harvest(state: GameState, command: Harvest): GameState {
  const { size } = state.world
  const { day } = state.time
  const cfg = balance()
  const plants = { ...state.farm.plants }
  const parcels = [...state.world.parcels]
  let free = storageCapacity(state, cfg) - storageUsed(state.storage)
  // The milestone counts from the harvest after the one that reaches it.
  const harvestPro = state.milestones.harvestProDay !== undefined
  // One batch per variety and quality.
  const stored = new Map<string, Batch>()
  for (const { x, y } of command.parcels) {
    const inside =
      Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size
    if (!inside) throw new Error(`Parcel ${x},${y} is outside the map`)
    const index = y * size + x
    if (!(index in state.farm.parcels)) throw new Error(`Parcel ${x},${y} is not owned`)
    const plant = plants[index]
    if (!plant) throw new Error(`Parcel ${x},${y} has no plant`)
    if (growth(plant, day, cfg).progress < 1)
      throw new Error(`Plant on parcel ${x},${y} is not ripe`)

    const factor = overripeFactor(plant, day, cfg)
    let units: number
    let base: number
    if (plant.pendingUnits !== undefined) {
      const stored = plant.overripeFactor ?? 1
      units = stored > 0 ? Math.floor((plant.pendingUnits * factor) / stored + 1e-9) : 0
      base = plant.pendingQuality!
    } else {
      const parcel = parcels[index]!
      const rng = mulberry32(harvestSeed(state.world.seed, day, index))
      const input = {
        variety: plant.variety,
        soilClass: parcel.soilClass,
        zoneMatches: parcel.zone === cfg.varieties[plant.variety].zone,
        fertilized: plant.fertilized ?? false,
      }
      const full = computeYield({ ...input, random: yieldRandom(rng, cfg) }, cfg)
      units = Math.floor(full * factor + 1e-9)
      base = baseQuality(
        { ...input, irrigated: plant.irrigated ?? false, random: qualityRandom(rng, cfg) },
        cfg,
      )
      const fertility = Math.max(0, parcel.fertility - cfg.soil.fertilityLossPerHarvest)
      const soilQuality = (fertility + parcel.waterRetention) / 200
      const soilClass = soilClassOf(soilQuality, cfg.soil.classMinQuality)
      parcels[index] = { ...parcel, fertility, soilQuality, soilClass }
    }

    const take = Math.max(0, Math.min(units, free))
    free -= take
    if (take > 0) {
      const quality = finalQuality(base, factor, harvestPro, cfg)
      const key = `${plant.variety}:${quality}`
      const batch = stored.get(key)
      stored.set(key, { variety: plant.variety, units: (batch?.units ?? 0) + take, quality })
    }
    if (take === units) delete plants[index]
    else
      plants[index] = {
        ...plant,
        pendingUnits: units - take,
        pendingQuality: base,
        overripeFactor: factor < 1 ? factor : undefined,
      }
  }

  const batches = [...stored.values()]
  const total = batches.reduce((sum, batch) => sum + batch.units, 0)
  const harvested = state.milestones.harvested + total
  const { harvestProDay } = state.milestones
  return {
    ...state,
    world: { ...state.world, parcels },
    farm: { ...state.farm, plants },
    storage: { ...state.storage, batches: [...state.storage.batches, ...batches] },
    milestones: {
      harvested,
      harvestProDay:
        harvestProDay ?? (harvested >= cfg.progression.harvestProUnits ? day : undefined),
    },
  }
}
