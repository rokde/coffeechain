import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import { bankSellPrice, buy } from '../market/market'
import { roundCost } from '../money'
import { isVarietyUnlocked } from '../progression/capital'
import type { GameState } from '../state'
import type { Variety } from './yield'

export interface Plant {
  type: 'Plant'
  variety: Variety
  parcels: { x: number; y: number }[]
}

export interface PlantState {
  variety: Variety
  plantedDay: number
  fertilized?: boolean
  irrigated?: boolean
  // Harvested units that did not fit into the storage.
  pendingUnits?: number
  // Overripe factor at the time pendingUnits was set. Missing means 1.
  overripeFactor?: number
}

export type Stage = keyof Balance['farm']['visualStages'] | 'reif'

export function plant(state: GameState, command: Plant): GameState {
  const { size } = state.world
  const cfg = balance()
  if (!Object.hasOwn(cfg.varieties, command.variety))
    throw new Error(`Unknown variety: ${command.variety}`)
  if (!isVarietyUnlocked(state, command.variety))
    throw new Error(`Variety ${command.variety} is locked`)

  const plants = { ...state.farm.plants }
  for (const { x, y } of command.parcels) {
    const inside =
      Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size
    if (!inside) throw new Error(`Parcel ${x},${y} is outside the map`)
    const index = y * size + x
    if (!(index in state.farm.parcels)) throw new Error(`Parcel ${x},${y} is not owned`)
    if (index in plants) throw new Error(`Parcel ${x},${y} already has a plant or is listed twice`)
    if (index in state.buildings) throw new Error(`Parcel ${x},${y} has a building`)
    plants[index] = { variety: command.variety, plantedDay: state.time.day }
  }

  const count = command.parcels.length
  const missing = missingSeeds(state, command.variety, count)
  const bought =
    missing > 0 ? buy(state, { type: 'Buy', variety: command.variety, units: missing }) : state
  const seeds = {
    ...bought.market.seeds,
    [command.variety]: (bought.market.seeds[command.variety] ?? 0) - count,
  }
  return { ...bought, market: { ...bought.market, seeds }, farm: { ...state.farm, plants } }
}

const missingSeeds = (state: GameState, variety: Variety, count: number) =>
  Math.max(0, count - (state.market.seeds[variety] ?? 0))

// Cost in hundredths of CC of the seed that the stock lacks for count parcels, with the rounding of buy().
export function quotePlant(state: GameState, variety: Variety, count: number): number {
  const missing = missingSeeds(state, variety, count)
  return roundCost(Math.round(missing * bankSellPrice(state, variety, missing) * 100))
}

export const ripeDay = (plant: PlantState, cfg: Balance = balance()): number =>
  plant.plantedDay + cfg.varieties[plant.variety].cycleDays

// Growth comes from the calendar days since planting, so it needs no per-step state.
export function growth(
  plant: PlantState,
  day: number,
  cfg: Balance = balance(),
): { progress: number; stage: Stage } {
  const cycle = cfg.varieties[plant.variety].cycleDays
  const progress = Math.min(1, (day - ripeDay(plant, cfg) + cycle) / cycle)
  return { progress, stage: stageAt(progress, cfg) }
}

// The visual stage for a growth progress from 0 to 1.
export function stageAt(progress: number, cfg: Balance = balance()): Stage {
  if (progress >= 1) return 'reif'
  const stages = Object.entries(cfg.farm.visualStages) as [Stage, number][]
  let stage = stages[0]![0]
  let best = -Infinity
  for (const [name, threshold] of stages) {
    if (threshold <= progress && threshold > best) [stage, best] = [name, threshold]
  }
  return stage
}
