import { balance } from '../balance'
import { isBuildable } from '../farm/parcels'
import type { SoilClass, World, Zone } from './types'

export type VarietyId = keyof ReturnType<typeof balance>['varieties']

export interface ParcelInfo {
  zone: Zone
  soilClass: SoilClass
  variety: VarietyId | null
  buildable: boolean
}

export function inspectParcel(world: World, x: number, y: number): ParcelInfo {
  const { zone, soilClass } = world.parcels[y * world.size + x]!
  const { varieties } = balance()
  const variety =
    (Object.keys(varieties) as VarietyId[]).find((id) => varieties[id].zone === zone) ?? null
  return { zone, soilClass, variety, buildable: isBuildable(world, x, y) }
}
