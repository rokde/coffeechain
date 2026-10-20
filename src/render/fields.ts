import { BufferGeometry, Float32BufferAttribute, Mesh, MeshLambertMaterial } from 'three'
import type { FarmState } from '../sim/farm/parcels'
import type { World } from '../sim/world/types'
import { corner } from './picking'
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
