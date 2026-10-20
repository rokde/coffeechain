import { balance } from '../balance'
import type { World, Zone } from '../world/types'
import { neighbours } from './parcels'

// Price of one parcel after the first, in hundredths of CC. The caller gives a land parcel.
export function parcelPrice(world: World, x: number, y: number): number {
  const { size, parcels } = world
  const { baseCost, zoneMultiplier, neighborWeight, worseGap, qualityFactor } = balance().parcels
  const parcel = parcels[y * size + x]!
  const own = parcel.soilQuality
  const land = neighbours(size, x, y)
    .map((n) => parcels[n]!)
    .filter((p) => p.zone !== 'wasser')
  const avg = land.length ? land.reduce((sum, p) => sum + p.soilQuality, 0) / land.length : own
  // Better neighbours pull the quality up by at most worseGap, so a clearly worse parcel stays cheap.
  const q = (1 - neighborWeight) * own + neighborWeight * Math.min(avg, own + worseGap)
  const factor = qualityFactor[0] + q * (qualityFactor[1] - qualityFactor[0])
  return Math.round(
    baseCost * zoneMultiplier[parcel.zone as Exclude<Zone, 'wasser'>] * factor * 100,
  )
}
