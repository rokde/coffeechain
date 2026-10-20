import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import type { GameState } from '../state'
import type { Variety } from './yield'

export interface Plant {
  type: 'Plant'
  variety: Variety
  parcels: { x: number; y: number }[]
}

export interface PlantState {
  variety: Variety
  plantedHour: number
  fertilized?: boolean
  irrigated?: boolean
  pestProtected?: boolean
  // Harvested units that did not fit into the storage.
  pendingUnits?: number
}

export type Stage = keyof Balance['farm']['visualStages'] | 'reif'

export function plant(state: GameState, command: Plant): GameState {
  const { size } = state.world
  const cfg = balance()
  const variety = cfg.varieties[command.variety]
  if (!variety) throw new Error(`Unknown variety: ${command.variety}`)
  // shortcut: only varieties with unlockCapital 0 can be planted, use the capital check from S29.
  if (variety.unlockCapital > 0) throw new Error(`Variety ${command.variety} is locked`)

  const plants = { ...state.farm.plants }
  for (const { x, y } of command.parcels) {
    const inside =
      Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size
    if (!inside) throw new Error(`Parcel ${x},${y} is outside the map`)
    const index = y * size + x
    if (!(index in state.farm.parcels)) throw new Error(`Parcel ${x},${y} is not owned`)
    if (index in plants) throw new Error(`Parcel ${x},${y} already has a plant or is listed twice`)
    plants[index] = { variety: command.variety, plantedHour: state.time.hour }
  }

  const cost = Math.round(variety.seedCost * 100) * command.parcels.length
  if (cost > state.money) throw new Error(`Not enough money: cost ${cost}, balance ${state.money}`)
  return { ...state, money: state.money - cost, farm: { ...state.farm, plants } }
}

// Growth comes only from the game hours since planting, so it needs no per-tick state.
export function growth(
  plant: PlantState,
  hour: number,
  cfg: Balance = balance(),
): { progress: number; stage: Stage } {
  const cycle = cfg.varieties[plant.variety].cycleDays * cfg.time.ticksPerGameDay
  const progress = Math.min(1, (hour - plant.plantedHour) / cycle)
  if (progress >= 1) return { progress, stage: 'reif' }
  const stages = Object.entries(cfg.farm.visualStages) as [Stage, number][]
  let stage = stages[0]![0]
  let best = -Infinity
  for (const [name, threshold] of stages) {
    if (threshold <= progress && threshold > best) [stage, best] = [name, threshold]
  }
  return { progress, stage }
}
