import { balance } from '../balance'
import type { GameState } from '../state'
import { soilClassOf } from '../world/generate'
import { growth } from './plants'

type Parcels = { x: number; y: number }[]
export interface Fertilize {
  type: 'Fertilize'
  parcels: Parcels
}
export interface Irrigate {
  type: 'Irrigate'
  parcels: Parcels
}
export interface ProtectPests {
  type: 'ProtectPests'
  parcels: Parcels
}

const cares = {
  Fertilize: { flag: 'fertilized', cost: 'fertilizer' },
  Irrigate: { flag: 'irrigated', cost: 'irrigation' },
  ProtectPests: { flag: 'pestProtected', cost: 'pestControl' },
} as const

// The cost comes from varieties.*.careCost, not market.fertilizerPrice (see docs/open-questions.md).
export function care(state: GameState, command: Fertilize | Irrigate | ProtectPests): GameState {
  const { flag, cost: costKey } = cares[command.type]
  const { size } = state.world
  const cfg = balance()
  const plants = { ...state.farm.plants }
  const parcels = [...state.world.parcels]
  let cost = 0
  for (const { x, y } of command.parcels) {
    const inside =
      Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size
    if (!inside) throw new Error(`Parcel ${x},${y} is outside the map`)
    const index = y * size + x
    if (!(index in state.farm.parcels)) throw new Error(`Parcel ${x},${y} is not owned`)
    const plant = plants[index]
    if (!plant) throw new Error(`Parcel ${x},${y} has no plant`)
    if (growth(plant, state.time.hour, cfg).progress >= 1)
      throw new Error(`Plant on parcel ${x},${y} is ripe`)
    if (plant[flag]) throw new Error(`Parcel ${x},${y} already has ${flag} or is listed twice`)
    plants[index] = { ...plant, [flag]: true }
    cost += Math.round(cfg.varieties[plant.variety].careCost[costKey] * 100)

    if (command.type === 'Fertilize') {
      const parcel = parcels[index]!
      const fertility = Math.min(100, parcel.fertility + cfg.soil.fertilityGainPerFertilize)
      const soilQuality = (fertility + parcel.waterRetention) / 200
      const soilClass = soilClassOf(soilQuality, cfg.soil.classMinQuality)
      parcels[index] = { ...parcel, fertility, soilQuality, soilClass }
    }
  }

  if (cost > state.money) throw new Error(`Not enough money: cost ${cost}, balance ${state.money}`)
  return {
    ...state,
    money: state.money - cost,
    world: command.type === 'Fertilize' ? { ...state.world, parcels } : state.world,
    farm: { ...state.farm, plants },
  }
}
