import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshLambertMaterial } from 'three'
import { balance } from '../sim/balance'
import type { World, Zone } from '../sim/world/types'

// Render constants, not balancing numbers.
const HEIGHT_SCALE = 6
export const ZONE_COLORS: Record<Zone, number> = {
  wasser: 0xc8b98e,
  tiefland: 0x8fb05a,
  hochland: 0x6a8f45,
  hochlandKuehl: 0x8c9a80,
  vulkan: 0x4e3f3a,
}

// One quad per parcel with its own 4 corners. A corner gets the mean height of the parcels that touch it.
export function buildTerrainGeometry(world: World): BufferGeometry {
  const { size: n, parcels } = world
  // The lowest land height is the sea level, so water parcels lie below y = 0.
  const seaLevel = balance().world.zoneMinHeight.tiefland
  const cornerY = (cx: number, cz: number) => {
    let sum = 0
    let count = 0
    for (let y = cz - 1; y <= cz; y++) {
      for (let x = cx - 1; x <= cx; x++) {
        if (x < 0 || y < 0 || x >= n || y >= n) continue
        sum += parcels[y * n + x]!.height
        count++
      }
    }
    return (sum / count - seaLevel) * HEIGHT_SCALE
  }

  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const color = new Color()
  for (const p of parcels) {
    color.setHex(ZONE_COLORS[p.zone])
    const base = positions.length / 3
    for (const [cx, cz] of [
      [p.x, p.y],
      [p.x + 1, p.y],
      [p.x + 1, p.y + 1],
      [p.x, p.y + 1],
    ] as const) {
      positions.push(cx - n / 2, cornerY(cx, cz), cz - n / 2)
      colors.push(color.r, color.g, color.b)
    }
    // Counter-clockwise from above, so the faces point up.
    indices.push(base, base + 3, base + 2, base, base + 2, base + 1)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createTerrain(world: World): Mesh {
  return new Mesh(
    buildTerrainGeometry(world),
    new MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  )
}
