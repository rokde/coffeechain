import { balance } from '../sim/balance'
import type { World } from '../sim/world/types'

// Render constant, not a balancing number. The terrain mesh in terrain.ts uses this formula too.
export const HEIGHT_SCALE = 6

// A corner gets the mean height of the 1 to 4 parcels that touch it. The sea level is at y = 0.
export function cornerY(world: World, cx: number, cz: number): number {
  const { size: n, parcels } = world
  let sum = 0
  let count = 0
  for (let y = cz - 1; y <= cz; y++) {
    for (let x = cx - 1; x <= cx; x++) {
      if (x < 0 || y < 0 || x >= n || y >= n) continue
      sum += parcels[y * n + x]!.height
      count++
    }
  }
  return (sum / count - balance().world.zoneMinHeight.tiefland) * HEIGHT_SCALE
}

// The terrain splits each quad along the (x, y)–(x + 1, y + 1) diagonal, so the center lies on it.
export function parcelCenter(world: World, x: number, y: number) {
  const half = (world.size - 1) / 2
  return {
    x: x - half,
    y: (cornerY(world, x, y) + cornerY(world, x + 1, y + 1)) / 2,
    z: y - half,
  }
}
