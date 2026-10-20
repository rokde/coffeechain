import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Raycaster,
  Vector2,
  type BufferAttribute,
  type Camera,
  type InterleavedBufferAttribute,
  type Mesh,
} from 'three'

export type ParcelPos = { x: number; y: number }

// Same grid as buildTerrainGeometry: parcel (x, y) has its corner at (x - size/2, y - size/2).
export function parcelAt(point: { x: number; z: number }, size: number): ParcelPos | null {
  const x = Math.floor(point.x + size / 2)
  const y = Math.floor(point.z + size / 2)
  return x >= 0 && y >= 0 && x < size && y < size ? { x, y } : null
}

const raycaster = new Raycaster()

// ndc: the pointer in normalized device coordinates (-1 to 1).
export function pickParcel(ndc: Vector2, camera: Camera, terrain: Mesh, size: number) {
  raycaster.setFromCamera(ndc, camera)
  const hit = raycaster.intersectObject(terrain)[0]
  return hit ? parcelAt(hit.point, size) : null
}

// Keep water parcels above the water plane at y = 0.
const corner = (corners: BufferAttribute | InterleavedBufferAttribute, i: number) =>
  [corners.getX(i), Math.max(corners.getY(i), 0) + 0.05, corners.getZ(i)] as const

// A white outline on the 4 corners of one parcel quad. show(null) hides it.
export function createOutline(terrain: Mesh, size: number) {
  const corners = terrain.geometry.getAttribute('position')
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(12), 3))
  const line = new LineLoop(geometry, new LineBasicMaterial({ color: 0xffffff }))
  line.visible = false

  function show(parcel: ParcelPos | null) {
    line.visible = parcel !== null
    if (!parcel) return
    const first = 4 * (parcel.y * size + parcel.x)
    const position = geometry.getAttribute('position')
    for (let i = 0; i < 4; i++) position.setXYZ(i, ...corner(corners, first + i))
    position.needsUpdate = true
    geometry.computeBoundingSphere()
  }

  return { line, show }
}

// White outlines of many parcels in one LineSegments. show rebuilds the geometry.
export function createOutlines(terrain: Mesh, size: number) {
  const corners = terrain.geometry.getAttribute('position')
  const line = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xffffff }))

  function show(parcels: readonly ParcelPos[]) {
    const points = parcels.flatMap(({ x, y }) => {
      const first = 4 * (y * size + x)
      // The 4 edges of the quad: corner 0-1, 1-2, 2-3 and 3-0.
      return [0, 1, 1, 2, 2, 3, 3, 0].flatMap((i) => corner(corners, first + i))
    })
    line.geometry.dispose()
    line.geometry = new BufferGeometry()
    line.geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  }

  return { line, show }
}
