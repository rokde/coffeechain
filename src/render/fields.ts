import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
} from 'three'
import type { FarmState } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import type { World } from '../sim/world/types'
import { buildingTop } from './buildings'
import { corner, type ParcelPos } from './picking'
import { parcelCenter } from './surface'

// Render constant: the dark soil of the fields in docs/mockups/.
const SOIL_COLOR = 0x6b4a32
// Render constant: the warm accent of the HUD, apart from the white selection outline.
const BORDER_COLOR = 0xf2c48d
// Render constants: the border width as a share of the parcel side, and its lift above the
// field mark. The selection outlines in picking.ts lie higher still.
const BORDER_WIDTH = 0.16
export const BORDER_LIFT = 0.02

// One anchor per field, at the mean parcel center of its parcels.
// The anchor goes up to the top of the highest building, so the label does not hide it.
export function fieldAnchors(
  world: World,
  farm: FarmState,
  buildings: Readonly<GameState['buildings']> = {},
) {
  return farm.fields.map(({ id, name }) => {
    const indexes = Object.entries(farm.parcels)
      .filter(([, field]) => field === id)
      .map(([index]) => +index)
    const centers = indexes.map((index) =>
      parcelCenter(world, index % world.size, Math.floor(index / world.size)),
    )
    const mean = (key: 'x' | 'y' | 'z') =>
      centers.reduce((sum, c) => sum + c[key], 0) / centers.length
    const tops = indexes.flatMap((index, i) =>
      buildings[index] ? [centers[i]!.y + buildingTop(buildings[index].kind)] : [],
    )
    return { id, name, position: { x: mean('x'), y: Math.max(mean('y'), ...tops), z: mean('z') } }
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

// The 4 edges of a parcel quad as corner pairs in the order of buildTerrainGeometry,
// each with the step to the neighbour across it.
const EDGES = [
  [0, 1, 0, -1],
  [1, 2, 1, 0],
  [2, 3, 0, 1],
  [3, 0, -1, 0],
] as const

// The outer edges of each field: [parcel index, corner a, corner b] for every edge of an owned
// parcel whose neighbour is not part of the same field.
export function fieldEdges(farm: FarmState, size: number): [number, number, number][] {
  return Object.entries(farm.parcels).flatMap(([key, field]) => {
    const index = +key
    const x = index % size
    const y = Math.floor(index / size)
    return EDGES.filter(([, , dx, dy]) => {
      const nx = x + dx
      const ny = y + dy
      const inside = nx >= 0 && ny >= 0 && nx < size && ny < size
      return !inside || farm.parcels[ny * size + nx] !== field
    }).map(([a, b]): [number, number, number] => [index, a, b])
  })
}

// A permanent border around each field, so owned parcels stay visible in every overlay.
// WebGL draws lines 1 px wide, so the border is a strip of rectangles on the inner side of each edge.
// The inner corners lie on the two quad sides next to the edge, so they are on the terrain surface,
// and the strips of one field join without gaps. show rebuilds the geometry.
export function createFieldBorders(terrain: Mesh, size: number) {
  const corners = terrain.geometry.getAttribute('position')
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial({ color: BORDER_COLOR }))

  function show(farm: FarmState) {
    const edges = fieldEdges(farm, size)
    const points = edges.flatMap(([index, a, b]) => {
      const at = (i: number) => corner(corners, 4 * index + (i % 4), BORDER_LIFT)
      // The point BORDER_WIDTH of the way from corner `from` to corner `to`.
      const inner = (from: number, to: number) =>
        at(from).map((v, k) => v + (at(to)[k]! - v) * BORDER_WIDTH)
      return [at(a), at(b), inner(b, b + 1), inner(a, a + 3)].flat()
    })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
    // Same winding as the terrain, so the faces point up.
    geometry.setIndex(edges.flatMap((_, e) => [0, 3, 2, 0, 2, 1].map((i) => 4 * e + i)))
    mesh.geometry.dispose()
    mesh.geometry = geometry
  }

  return { mesh, show }
}
