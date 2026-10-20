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

// The terrain height at a world point, on the same two triangles per quad as buildTerrainGeometry.
export function terrainHeightAt(world: World, x: number, z: number): number {
  const n = world.size
  const gx = x + n / 2
  const gz = z + n / 2
  const cx = Math.min(n - 1, Math.max(0, Math.floor(gx)))
  const cz = Math.min(n - 1, Math.max(0, Math.floor(gz)))
  const fx = gx - cx
  const fz = gz - cz
  const h00 = cornerY(world, cx, cz)
  const h11 = cornerY(world, cx + 1, cz + 1)
  if (fz >= fx) {
    const h01 = cornerY(world, cx, cz + 1)
    return h00 + fx * (h11 - h01) + fz * (h01 - h00)
  }
  const h10 = cornerY(world, cx + 1, cz)
  return h00 + fx * (h10 - h00) + fz * (h11 - h10)
}
