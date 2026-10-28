import { balance } from '../sim/balance'
import type { PlantState } from '../sim/farm/plants'
import type { Variety } from '../sim/farm/yield'
import { createState, type GameState } from '../sim/state'

// PRD §11: the full farm must run at 60 fps.
export const PERF_PLANTS = 2000

// A full farm: the farm owns all parcels, and the first PERF_PLANTS parcels have a plant.
// The plants cycle through all varieties and all stages.
export function perfFixture(seed = 1): GameState {
  const cfg = balance()
  const state = createState(seed)
  const { size } = state.world
  const day = 100 * cfg.time.daysPerMonth
  const varieties = Object.keys(cfg.varieties) as Variety[]
  // Stage k lies between bounds k and k + 1. Progress 1 and more is reif.
  const bounds = [...Object.values(cfg.farm.visualStages).sort((a, b) => a - b), 1, 2]
  const stages = bounds.length - 1
  const parcels: Record<number, number> = {}
  const plants: Record<number, PlantState> = {}
  for (let i = 0; i < size * size; i++) {
    parcels[i] = 0
    if (i >= PERF_PLANTS) continue
    const variety = varieties[i % varieties.length]!
    const k = Math.floor(i / varieties.length) % stages
    const progress = (bounds[k]! + bounds[k + 1]!) / 2
    const cycle = cfg.varieties[variety].cycleDays
    plants[i] = { variety, plantedDay: day - progress * cycle }
  }
  return {
    ...state,
    time: { ...state.time, day },
    farm: { parcels, fields: [{ id: 0, name: 'A' }], nextFieldId: 1, plants },
  }
}
