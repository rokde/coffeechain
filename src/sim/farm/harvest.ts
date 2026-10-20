import { balance } from '../balance'
import { yieldEventFactor } from '../events/effects'
import { mulberry32 } from '../rng'
import type { GameState } from '../state'
import { storageCapacity } from '../storage/capacity'
import { storageUsed, type Batch } from '../storage/storage'
import { clock } from '../time/time'
import { soilClassOf } from '../world/generate'
import { overripeFactor } from './overripe'
import { growth } from './plants'
import { computeYield, yieldRandom, type Variety } from './yield'

export interface Harvest {
  type: 'Harvest'
  parcels: { x: number; y: number }[]
}

// Seeds the yield roll from the world seed, the hour and the parcel, so the state needs no PRNG.
export function harvestSeed(seed: number, hour: number, index: number): number {
  return (seed ^ Math.imul(hour + 1, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0
}

export function harvestQuality(state: GameState, cfg = balance()): number {
  const { harvestProHour } = state.milestones
  const base = cfg.storage.harvestQuality
  if (harvestProHour === undefined) return base
  return Math.min(100, base * (1 + cfg.progression.harvestProQualityBonus))
}

export function harvest(state: GameState, command: Harvest): GameState {
  const { size } = state.world
  const { hour } = state.time
  const cfg = balance()
  const plants = { ...state.farm.plants }
  const parcels = [...state.world.parcels]
  let free = storageCapacity(state, cfg) - storageUsed(state.storage)
  const stored = new Map<Variety, number>()
  for (const { x, y } of command.parcels) {
    const inside =
      Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size
    if (!inside) throw new Error(`Parcel ${x},${y} is outside the map`)
    const index = y * size + x
    if (!(index in state.farm.parcels)) throw new Error(`Parcel ${x},${y} is not owned`)
    const plant = plants[index]
    if (!plant) throw new Error(`Parcel ${x},${y} has no plant`)
    if (growth(plant, hour, cfg).progress < 1)
      throw new Error(`Plant on parcel ${x},${y} is not ripe`)

    const factor = overripeFactor(plant, hour, cfg)
    let units: number
    if (plant.pendingUnits !== undefined) {
      const stored = plant.overripeFactor ?? 1
      units = stored > 0 ? Math.floor((plant.pendingUnits * factor) / stored + 1e-9) : 0
    } else {
      const parcel = parcels[index]!
      const full = computeYield(
        {
          variety: plant.variety,
          soilClass: parcel.soilClass,
          zoneMatches: parcel.zone === cfg.varieties[plant.variety].zone,
          fertilized: plant.fertilized ?? false,
          eventFactor: yieldEventFactor(state, index, clock(hour).day),
          random: yieldRandom(mulberry32(harvestSeed(state.world.seed, hour, index)), cfg),
        },
        cfg,
      )
      units = Math.floor(full * factor + 1e-9)
      const fertility = Math.max(0, parcel.fertility - cfg.soil.fertilityLossPerHarvest)
      const soilQuality = (fertility + parcel.waterRetention) / 200
      const soilClass = soilClassOf(soilQuality, cfg.soil.classMinQuality)
      parcels[index] = { ...parcel, fertility, soilQuality, soilClass }
    }

    const take = Math.max(0, Math.min(units, free))
    free -= take
    if (take > 0) stored.set(plant.variety, (stored.get(plant.variety) ?? 0) + take)
    if (take === units) delete plants[index]
    else
      plants[index] = {
        ...plant,
        pendingUnits: units - take,
        overripeFactor: factor < 1 ? factor : undefined,
      }
  }

  const quality = harvestQuality(state, cfg)
  const total = [...stored.values()].reduce((a, b) => a + b, 0)
  const harvested = state.milestones.harvested + total
  const { harvestProHour } = state.milestones
  const batches: Batch[] = [...stored].map(([variety, units]) => ({ variety, units, quality }))
  return {
    ...state,
    world: { ...state.world, parcels },
    farm: { ...state.farm, plants },
    storage: { ...state.storage, batches: [...state.storage.batches, ...batches] },
    milestones: {
      harvested,
      harvestProHour:
        harvestProHour ?? (harvested >= cfg.progression.harvestProUnits ? hour : undefined),
    },
  }
}
