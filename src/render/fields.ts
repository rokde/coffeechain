import { BufferGeometry, Float32BufferAttribute, Mesh, MeshLambertMaterial } from 'three'
import type { FarmState } from '../sim/farm/parcels'
import type { World } from '../sim/world/types'
import { corner, type ParcelPos } from './picking'
import { parcelCenter } from './surface'

// Render constant: the dark soil of the fields in docs/mockups/.
const SOIL_COLOR = 0x6b4a32

// One anchor per field, at the mean parcel center of its parcels.
export function fieldAnchors(world: World, farm: FarmState) {
  return farm.fields.map(({ id, name }) => {
    const centers = Object.entries(farm.parcels)
      .filter(([, field]) => field === id)
      .map(([index]) => parcelCenter(world, +index % world.size, Math.floor(+index / world.size)))
    const mean = (key: 'x' | 'y' | 'z') =>
      centers.reduce((sum, c) => sum + c[key], 0) / centers.length
    return { id, name, position: { x: mean('x'), y: mean('y'), z: mean('z') } }
  })
}

// Render constant: a small, light label, so it covers little of the map. The layer has no pointer events.
export const FIELD_LABEL_STYLE =
  'position:absolute;transform:translate(-50%,calc(-100% - 6px));white-space:nowrap;' +
  'padding:2px 8px;border-radius:999px;background:rgb(43 36 32 / 65%);color:#f5ece0;' +
  'font:600 12px system-ui,sans-serif;transition:opacity 150ms'

type Box = { left: number; top: number; right: number; bottom: number }

// The field whose label must fade: a label under the pointer first, else the field of the hovered parcel.
export function hoveredField(
  parcel: ParcelPos | null,
  farm: FarmState,
  size: number,
  pointer: { x: number; y: number },
  labels: { id: number; box: Box }[],
): number | null {
  const { x, y } = pointer
  const hit = labels.find(
    ({ box }) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom,
  )
  if (hit) return hit.id
  return parcel ? (farm.parcels[parcel.y * size + parcel.x] ?? null) : null
}

// One brown quad on each owned parcel, a little above the terrain. show rebuilds the geometry.
export function createFieldMarks(terrain: Mesh) {
  const corners = terrain.geometry.getAttribute('position')
  const mesh = new Mesh(
    new BufferGeometry(),
    new MeshLambertMaterial({ color: SOIL_COLOR, flatShading: true }),
  )

  function show(farm: FarmState) {
    // The terrain has 4 corners per parcel, in parcel index order.
    const quads = Object.keys(farm.parcels).map((index) => 4 * +index)
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        quads.flatMap((first) => [0, 1, 2, 3].flatMap((i) => corner(corners, first + i))),
        3,
      ),
    )
    // Same triangles as the terrain, so the faces point up.
    geometry.setIndex(quads.flatMap((_, q) => [0, 3, 2, 0, 2, 1].map((i) => 4 * q + i)))
    geometry.computeVertexNormals()
    mesh.geometry.dispose()
    mesh.geometry = geometry
  }

  return { mesh, show }
}
