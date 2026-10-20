import { Box3, Vector3, type Mesh } from 'three'
import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { generateWorld } from '../sim/world/generate'
import { buildingGeometry, createBuildings } from './buildings'
import { parcelCenter } from './surface'

const world = generateWorld(42, balance())
const buildings = {
  [3 * world.size + 4]: { kind: 'processing' as const },
  [7 * world.size + 2]: { kind: 'storage' as const },
}
const meshesOf = (group: { children: unknown[] }) => group.children as Mesh[]

describe('createBuildings', () => {
  it('AC-1: shows one mesh for each building and replaces the old meshes', () => {
    const { group, show } = createBuildings(world)
    show(buildings)
    const data = meshesOf(group).map((m) => m.userData)
    expect(data).toEqual([
      { building: 'processing', x: 4, y: 3 },
      { building: 'storage', x: 2, y: 7 },
    ])
    show(buildings)
    expect(meshesOf(group)).toHaveLength(2)
    show({})
    expect(meshesOf(group)).toHaveLength(0)
  })

  it('AC-2: puts each mesh on its parcel, just above the field mark', () => {
    const { group, show } = createBuildings(world)
    show(buildings)
    for (const mesh of meshesOf(group)) {
      const { x, y } = mesh.userData as { x: number; y: number }
      const c = parcelCenter(world, x, y)
      expect(mesh.position.x).toBeCloseTo(c.x)
      expect(mesh.position.z).toBeCloseTo(c.z)
      const box = new Box3().setFromObject(mesh)
      expect(box.min.y).toBeGreaterThan(c.y)
      expect(box.min.y).toBeLessThan(c.y + 0.1)
    }
  })
})

describe('buildingGeometry', () => {
  it('AC-3: gives two different shapes that fit in one parcel', () => {
    const sizes = (['processing', 'storage'] as const).map((kind) => {
      const geometry = buildingGeometry(kind)
      geometry.computeBoundingBox()
      return geometry.boundingBox!.getSize(new Vector3())
    })
    expect(sizes[0]).not.toEqual(sizes[1])
    for (const size of sizes) {
      expect(size.x).toBeLessThan(1)
      expect(size.z).toBeLessThan(1)
      expect(size.y).toBeGreaterThan(0)
    }
  })
})
