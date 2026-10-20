import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BuildingKind } from '../sim/buildings/build'
import type { World } from '../sim/world/types'
import { colored, LIFT } from './plants'
import { parcelCenter } from './surface'

type Buildings = Readonly<Record<number, Readonly<{ kind: BuildingKind }>>>

// Render constants, not balancing numbers.
const WALL = 0xd9c7a3
const ROOF = 0x9a3b2a
const SILO = 0xc8ccd0
const SILO_TOP = 0x6f7880

// The base is at y = 0, the footprint stays inside one parcel.
export function buildingGeometry(kind: BuildingKind): BufferGeometry {
  if (kind === 'processing') {
    // A wide, low shed with a hip roof. A 4-sided cone turned by 45° is a square pyramid.
    const walls = new BoxGeometry(0.75, 0.25, 0.55).translate(0, 0.125, 0)
    const roof = new ConeGeometry(Math.SQRT1_2, 0.2, 4)
      .rotateY(Math.PI / 4)
      .scale(0.85, 1, 0.65)
      .translate(0, 0.35, 0)
    return mergeGeometries([colored(walls, WALL), colored(roof, ROOF)])
  }
  // A tall silo with a cone top.
  const silo = new CylinderGeometry(0.2, 0.2, 0.6, 10).translate(0, 0.3, 0)
  const top = new ConeGeometry(0.22, 0.18, 10).translate(0, 0.69, 0)
  return mergeGeometries([colored(silo, SILO), colored(top, SILO_TOP)])
}

// The height of the building top above the parcel center.
export function buildingTop(kind: BuildingKind): number {
  const geometry = buildingGeometry(kind)
  geometry.computeBoundingBox()
  return geometry.boundingBox!.max.y + LIFT
}

export function createBuildings(world: World) {
  const group = new Group()
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true })
  const geometries: Record<BuildingKind, BufferGeometry> = {
    processing: buildingGeometry('processing'),
    storage: buildingGeometry('storage'),
  }

  function show(buildings: Buildings) {
    group.clear()
    for (const [key, { kind }] of Object.entries(buildings)) {
      const index = Number(key)
      const x = index % world.size
      const y = Math.floor(index / world.size)
      const c = parcelCenter(world, x, y)
      const mesh = new Mesh(geometries[kind], material)
      // shortcut: flat base at the parcel center, no tilt to the slope; tilt it when steep parcels look wrong.
      mesh.position.set(c.x, c.y + LIFT, c.z)
      mesh.userData = { building: kind, x, y }
      group.add(mesh)
    }
  }

  return { group, show }
}
