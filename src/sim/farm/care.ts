import { balance } from '../balance'
import { roundCost } from '../money'
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

export const cares = {
  Fertilize: { flag: 'fertilized', cost: 'fertilizer' },
  Irrigate: { flag: 'irrigated', cost: 'irrigation' },
  ProtectPests: { flag: 'pestProtected', cost: 'pestControl' },
} as const

// The cost comes from varieties.*.careCost, not market.fertilizerPrice (see docs/open-questions.md).
export function care(state: GameState, command: Fertilize | Irrigate | ProtectPests): GameState {
  const { flag } = cares[command.type]
  const { size } = state.world
  const cfg = balance()
  const plants = { ...state.farm.plants }
  const parcels = [...state.world.parcels]
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

    if (command.type === 'Fertilize') {
      const parcel = parcels[index]!
      const fertility = Math.min(100, parcel.fertility + cfg.soil.fertilityGainPerFertilize)
      const soilQuality = (fertility + parcel.waterRetention) / 200
      const soilClass = soilClassOf(soilQuality, cfg.soil.classMinQuality)
      parcels[index] = { ...parcel, fertility, soilQuality, soilClass }
    }
  }

  const cost = quoteCare(state, command)
  if (cost > state.money) throw new Error(`Not enough money: cost ${cost}, balance ${state.money}`)
  return {
    ...state,
    money: state.money - cost,
    world: command.type === 'Fertilize' ? { ...state.world, parcels } : state.world,
    farm: { ...state.farm, plants },
  }
}

// Cost in hundredths of CC of one care for the plants on the parcels. A parcel without a plant costs nothing.
export function quoteCare(state: GameState, command: Fertilize | Irrigate | ProtectPests): number {
  const { cost } = cares[command.type]
  const { varieties } = balance()
  return roundCost(
    command.parcels.reduce((sum, { x, y }) => {
      const plant = state.farm.plants[y * state.world.size + x]
      return plant ? sum + Math.round(varieties[plant.variety].careCost[cost] * 100) : sum
    }, 0),
  )
}
