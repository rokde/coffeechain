import { Matrix4, Vector3, type BufferAttribute, type InstancedMesh } from 'three'
import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import type { PlantState } from '../sim/farm/plants'
import type { Variety } from '../sim/farm/yield'
import { generateWorld } from '../sim/world/generate'
import { createPlants, plantGeometry, plantsKey, plantVariants, STAGES } from './plants'
import { parcelCenter } from './surface'

const world = generateWorld(42, balance())
// Robusta has a 90 day cycle, Arabica Standard 150 days. At day 300:
// planted at 300 is setzling, planted at 0 is reif, Arabica planted at 210 is at 0.6 (bluete).
const DAY = 300
const plants: Record<number, PlantState> = {
  [3 * world.size + 4]: { variety: 'robusta', plantedDay: DAY },
  [3 * world.size + 5]: { variety: 'robusta', plantedDay: DAY },
  [7 * world.size + 2]: { variety: 'robusta', plantedDay: 0 },
  [8 * world.size + 9]: { variety: 'arabicaStandard', plantedDay: 210 },
}

const meshesOf = (group: { children: unknown[] }) => group.children as InstancedMesh[]

describe('plantVariants', () => {
  it('AC-1: groups the parcel indexes by variety and stage', () => {
    const variants = plantVariants(plants, DAY)
    expect(Object.fromEntries(variants)).toEqual({
      'robusta/setzling': [3 * world.size + 4, 3 * world.size + 5],
      'robusta/reif': [7 * world.size + 2],
      'arabicaStandard/bluete': [8 * world.size + 9],
    })
    expect(plantVariants({}, DAY).size).toBe(0)
  })
})

describe('createPlants', () => {
  it('AC-2: sets the instance count of each variant mesh', () => {
    const { group, show } = createPlants(world)
    expect(meshesOf(group)).toHaveLength(Object.keys(balance().varieties).length * STAGES.length)
    show(plants, DAY)
    const expected: Record<string, number> = {
      'robusta/setzling': 2,
      'robusta/reif': 1,
      'arabicaStandard/bluete': 1,
    }
    for (const mesh of meshesOf(group)) expect(mesh.count).toBe(expected[mesh.name] ?? 0)
    show({}, DAY)
    for (const mesh of meshesOf(group)) expect(mesh.count).toBe(0)
  })

  it('AC-3: puts each instance on its parcel center, above the field mark', () => {
    const { group, show } = createPlants(world)
    show(plants, DAY)
    const mesh = meshesOf(group).find((m) => m.name === 'arabicaStandard/bluete')!
    const at = new Vector3().setFromMatrixPosition(mesh.getMatrixAt(0, new Matrix4()))
    const c = parcelCenter(world, 9, 8)
    expect(at.x).toBeCloseTo(c.x)
    expect(at.z).toBeCloseTo(c.z)
    expect(at.y).toBeGreaterThan(c.y + 0.05)
  })
})

describe('plantsKey', () => {
  it('AC-4: changes only with a stage change or a new plant', () => {
    const one = { 0: { variety: 'robusta', plantedDay: 0 } as PlantState }
    // Robusta: wachstum starts at 0.25 of 90 days (day 22.5), bluete at 0.6 (day 54).
    expect(plantsKey(one, 25)).toBe(plantsKey(one, 50))
    expect(plantsKey(one, 55)).not.toBe(plantsKey(one, 50))
    const two = { ...one, 1: { variety: 'robusta', plantedDay: 0 } as PlantState }
    expect(plantsKey(two, 50)).not.toBe(plantsKey(one, 50))
  })
})

describe('plantGeometry', () => {
  it('AC-5: gives each stage its own height and red cherries for reif', () => {
    for (const variety of Object.keys(balance().varieties) as Variety[]) {
      const heights = STAGES.map((stage) => {
        const g = plantGeometry(variety, stage)
        g.computeBoundingBox()
        return g.boundingBox!.max.y - g.boundingBox!.min.y
      })
      expect(new Set(heights).size).toBe(STAGES.length)
    }
    const colors = plantGeometry('robusta', 'reif').getAttribute('color') as BufferAttribute
    const red = Array.from({ length: colors.count }, (_, i) => i).some(
      (i) => colors.getX(i) > colors.getY(i) && colors.getX(i) > colors.getZ(i),
    )
    expect(red).toBe(true)
  })
})
