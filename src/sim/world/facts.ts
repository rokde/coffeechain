import type { SoilClass, World, Zone } from './types'

export type LandZone = Exclude<Zone, 'wasser'>

export interface IslandFacts {
  // Whole percent of all land parcels per zone.
  shares: Record<LandZone, number>
  hut: { x: number; y: number; zone: Zone; soilClass: SoilClass }
}

export function islandFacts(world: World): IslandFacts {
  const count = { tiefland: 0, hochland: 0, hochlandKuehl: 0 }
  let land = 0
  for (const { zone } of world.parcels) {
    if (zone === 'wasser') continue
    count[zone]++
    land++
  }
  const pct = (n: number) => (land === 0 ? 0 : Math.round((n / land) * 100))
  const { x, y } = world.start
  const { zone, soilClass } = world.parcels[y * world.size + x]!
  return {
    shares: {
      tiefland: pct(count.tiefland),
      hochland: pct(count.hochland),
      hochlandKuehl: pct(count.hochlandKuehl),
    },
    hut: { x, y, zone, soilClass },
  }
}
