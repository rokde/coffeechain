import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three'
import type { Place } from '../sim/world/props'
import type { World } from '../sim/world/types'
import { parcelCenter, terrainHeightAt } from './surface'

// Render constants, not balancing numbers.
export const PATH = {
  // Ribbon width in parcels.
  width: 0.4,
  // Height above the terrain.
  lift: 0.08,
  // The largest distance between two samples along the path.
  step: 0.1,
  // Cool light stone: apart from the terrain, the zone colors and the soil palette.
  color: 0xc4d0de,
}

// One flat ribbon through the parcel centers of the path, from the hut to the market.
export function buildPathGeometry(world: World, path: readonly Place[]): BufferGeometry {
  const points = path.map((p) => parcelCenter(world, p.x, p.y))
  const half = PATH.width / 2
  // The left normal of each segment in the (x, z) plane.
  const normals = points.slice(1).map((b, i) => {
    const a = points[i]!
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    return { x: -(b.z - a.z) / len, z: (b.x - a.x) / len }
  })
  const positions: number[] = []
  const add = (x: number, z: number, nx: number, nz: number) => {
    for (const s of [1, -1]) {
      const px = x + s * nx
      const pz = z + s * nz
      positions.push(px, terrainHeightAt(world, px, pz) + PATH.lift, pz)
    }
  }
  normals.forEach((n, i) => {
    const a = points[i]!
    const b = points[i + 1]!
    // A miter at a bend keeps the full width on both legs.
    const prev = normals[i - 1] ?? n
    const mx = prev.x + n.x
    const mz = prev.z + n.z
    const scale = half / (mx * n.x + mz * n.z)
    add(a.x, a.z, mx * scale, mz * scale)
    const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / PATH.step)
    for (let k = 1; k < count; k++) {
      const t = k / count
      add(a.x + t * (b.x - a.x), a.z + t * (b.z - a.z), n.x * half, n.z * half)
    }
  })
  const last = points.at(-1)!
  const n = normals.at(-1)!
  add(last.x, last.z, n.x * half, n.z * half)

  const indices: number[] = []
  for (let v = 0; v + 3 < positions.length / 3; v += 2) {
    // Counter-clockwise from above, like the terrain.
    indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}

export function createPath(world: World, path: readonly Place[]): Mesh {
  return new Mesh(
    buildPathGeometry(world, path),
    new MeshBasicMaterial({
      color: PATH.color,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  )
}
