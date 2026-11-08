import { balance } from '../balance'
import { isBuildable, neighbours } from '../farm/parcels'
import type { GameState } from '../state'
import type { SoilClass, Zone } from './types'

export type VarietyId = keyof ReturnType<typeof balance>['varieties']

// What stands on the parcel. Trees do not block: buying the parcel clears them.
export type Occupant = 'hut' | 'market' | 'path' | 'tree' | 'plant' | null
export type TerrainState = 'buildable' | 'occupied' | 'tooSteep' | 'water'

export interface ParcelInfo {
  zone: Zone
  soilClass: SoilClass
  variety: VarietyId | null
  height: number
  // Largest height step to a 4-neighbour.
  slope: number
  occupant: Occupant
  state: TerrainState
}

export function inspectParcel(state: GameState, x: number, y: number): ParcelInfo {
  const { world, props } = state
  const { zone, soilClass, height } = world.parcels[y * world.size + x]!
  const { varieties } = balance()
  const variety =
    (Object.keys(varieties) as VarietyId[]).find((id) => varieties[id].zone === zone) ?? null
  const slope = Math.max(
    ...neighbours(world.size, x, y).map((n) => Math.abs(world.parcels[n]!.height - height)),
  )
  const at = (p: { x: number; y: number }) => p.x === x && p.y === y
  const occupant: Occupant = at(props.hut)
    ? 'hut'
    : at(props.market)
      ? 'market'
      : props.path.some(at)
        ? 'path'
        : state.farm.plants[y * world.size + x]
          ? 'plant'
          : props.trees.some(at)
            ? 'tree'
            : null
  const terrain = zone === 'wasser' ? 'water' : isBuildable(world, x, y) ? 'ok' : 'tooSteep'
  const occupied = occupant === 'hut' || occupant === 'market' || occupant === 'path'
  const result: TerrainState =
    terrain === 'ok' ? (occupied ? 'occupied' : 'buildable') : (terrain as TerrainState)
  return { zone, soilClass, variety, height, slope, occupant, state: result }
}
