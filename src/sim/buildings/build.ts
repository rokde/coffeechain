import { balance } from '../balance'
import type { GameState } from '../state'

export type BuildingKind = 'processing' | 'storage'

export interface Build {
  type: 'Build'
  building: BuildingKind
  parcel: { x: number; y: number }
}

export interface MenuEntry {
  kind: BuildingKind
  // Hundredths of CC.
  cost: number
  locked: boolean
  requiredPhase: number
  // False when the farm has the maximum number of this building.
  available: boolean
}

// shortcut: phase is always 1, use the capital phase from S47
const PHASE = 1

const count = (state: GameState, kind: BuildingKind) =>
  Object.values(state.buildings).filter((b) => b.kind === kind).length

export function buildMenu(state: GameState): MenuEntry[] {
  const { processing, storage } = balance()
  const built = count(state, 'storage')
  // After the last stage, the entry shows the last stage and is not available.
  const stage = storage.upgrades[Math.min(built, storage.upgrades.length - 1)]!
  const entry = (kind: BuildingKind, cost: number, requiredPhase: number, available: boolean) => ({
    kind,
    cost: Math.round(cost * 100),
    locked: requiredPhase > PHASE,
    requiredPhase,
    available,
  })
  return [
    entry(
      'processing',
      processing.washed.buildCost,
      processing.washed.requiresPhase,
      count(state, 'processing') === 0,
    ),
    entry('storage', stage.cost, stage.requiresPhase, built < storage.upgrades.length),
  ]
}

// A building can stand on an owned parcel with no plant and no building.
export function canBuild(state: GameState, x: number, y: number): boolean {
  const { size } = state.world
  const inside =
    Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size
  const index = y * size + x
  return (
    inside &&
    index in state.farm.parcels &&
    !(index in state.farm.plants) &&
    !(index in state.buildings)
  )
}

export function build(state: GameState, command: Build): GameState {
  const { x, y } = command.parcel
  if (!canBuild(state, x, y))
    throw new Error(`Parcel ${x},${y} is outside the map, not owned, or has a plant or building`)
  const entry = buildMenu(state).find((e) => e.kind === command.building)!
  if (!entry.available) throw new Error(`The farm has the maximum of ${command.building}`)
  if (entry.locked) throw new Error(`${command.building} needs phase ${entry.requiredPhase}`)
  if (entry.cost > state.money)
    throw new Error(`Not enough money: cost ${entry.cost}, balance ${state.money}`)
  return {
    ...state,
    money: state.money - entry.cost,
    buildings: { ...state.buildings, [y * state.world.size + x]: { kind: command.building } },
  }
}
