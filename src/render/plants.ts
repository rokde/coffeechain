import {
  BufferGeometry,
  Color,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { balance } from '../sim/balance'
import { growth, type PlantState, type Stage } from '../sim/farm/plants'
import type { Variety } from '../sim/farm/yield'
import type { World } from '../sim/world/types'
import { parcelCenter } from './surface'

type Plants = Readonly<Record<number, Readonly<PlantState>>>

export const STAGES: readonly Stage[] = ['setzling', 'wachstum', 'bluete', 'fruchtansatz', 'reif']

// Render constants, not balancing numbers.
const STAGE_SIZE: Record<Stage, number> = {
  setzling: 0.7,
  wachstum: 0.75,
  bluete: 0.8,
  fruchtansatz: 0.9,
  reif: 1,
}
const LEAF: Record<Variety, number> = {
  robusta: 0x3f7f2e,
  arabicaStandard: 0x2d6a3a,
  arabicaPremium: 0x356f2a,
  specialty: 0x2a5e30,
}
const SEEDLING_GREEN = 0x9ccc65
const ACCENT: Partial<Record<Stage, number>> = {
  bluete: 0xffffff,
  fruchtansatz: 0xc0d040,
  reif: 0xd0302a,
}
const ROWS = [-0.3, 0, 0.3]
const BUSH_HEIGHT = 0.4
const BUSH_RADIUS = 0.13
// Above the field mark lift of 0.05 in picking.ts.
export const LIFT = 0.06

export function colored(geometry: BufferGeometry, hex: number) {
  const c = new Color(hex)
  const count = geometry.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3)
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

// One parcel: 3 rows of 3 bushes. The base is at y = 0.
export function plantGeometry(variety: Variety, stage: Stage): BufferGeometry {
  const s = STAGE_SIZE[stage]
  const h = BUSH_HEIGHT * s
  const r = BUSH_RADIUS * s
  const leaf =
    stage === 'setzling'
      ? new Color(LEAF[variety]).lerp(new Color(SEEDLING_GREEN), 0.6)
      : new Color(LEAF[variety])
  const accent = ACCENT[stage]
  const parts: BufferGeometry[] = []
  for (const x of ROWS) {
    for (const z of ROWS) {
      parts.push(colored(new ConeGeometry(r, h, 6).translate(x, h / 2, z), leaf.getHex()))
      if (accent === undefined) continue
      // Three accents on the sides of each bush.
      for (let k = 0; k < 3; k++) {
        const a = (k * 2 * Math.PI) / 3 + x + z
        const dot = new SphereGeometry(r * 0.35, 4, 3).translate(
          x + Math.cos(a) * r * 0.6,
          h * (0.3 + 0.15 * k),
          z + Math.sin(a) * r * 0.6,
        )
        parts.push(colored(dot, accent))
      }
    }
  }
  return mergeGeometries(parts)
}

export function plantVariants(plants: Plants, day: number): Map<string, number[]> {
  const variants = new Map<string, number[]>()
  for (const [index, plant] of Object.entries(plants)) {
    const key = `${plant.variety}/${growth(plant, day).stage}`
    const list = variants.get(key) ?? []
    list.push(Number(index))
    variants.set(key, list)
  }
  return variants
}

export function plantsKey(plants: Plants, day: number): string {
  return Object.entries(plants)
    .map(([index, plant]) => `${index}:${plant.variety}/${growth(plant, day).stage}`)
    .join(',')
}

export function createPlants(world: World) {
  const group = new Group()
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true })
  const capacity = world.size * world.size
  const meshes = new Map<string, InstancedMesh>()
  for (const variety of Object.keys(balance().varieties) as Variety[]) {
    for (const stage of STAGES) {
      const mesh = new InstancedMesh(plantGeometry(variety, stage), material, capacity)
      mesh.count = 0
      mesh.name = `${variety}/${stage}`
      meshes.set(mesh.name, mesh)
      group.add(mesh)
    }
  }

  const matrix = new Matrix4()
  function show(plants: Plants, day: number) {
    const variants = plantVariants(plants, day)
    for (const [key, mesh] of meshes) {
      const indexes = variants.get(key) ?? []
      indexes.forEach((index, i) => {
        const c = parcelCenter(world, index % world.size, Math.floor(index / world.size))
        mesh.setMatrixAt(i, matrix.makeTranslation(c.x, c.y + LIFT, c.z))
      })
      mesh.count = indexes.length
      mesh.instanceMatrix.needsUpdate = true
      // The renderer culls with the bounding sphere, so it must follow the new instances.
      mesh.computeBoundingSphere()
    }
  }

  return { group, show }
}
