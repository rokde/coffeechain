import { Matrix4, Vector3, type BufferAttribute, type InstancedMesh } from 'three'
import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import type { PlantState } from '../sim/farm/plants'
import type { Variety } from '../sim/farm/yield'
import { generateWorld } from '../sim/world/generate'
import { createPlants, plantGeometry, plantsKey, plantVariants, STAGES } from './plants'
import { parcelCenter } from './surface'

const world = generateWorld(42, balance())
const { ticksPerGameDay } = balance().time
const DAY = ticksPerGameDay
// Robusta has a 3 day cycle, Arabica Standard 5 days. At hour 10 * DAY:
// planted at 10 * DAY is setzling, planted at 0 is reif, Arabica planted at 7 * DAY is at 0.6 (bluete).
const HOUR = 10 * DAY
const plants: Record<number, PlantState> = {
  [3 * world.size + 4]: { variety: 'robusta', plantedHour: HOUR },
  [3 * world.size + 5]: { variety: 'robusta', plantedHour: HOUR },
  [7 * world.size + 2]: { variety: 'robusta', plantedHour: 0 },
  [8 * world.size + 9]: { variety: 'arabicaStandard', plantedHour: 7 * DAY },
}

const meshesOf = (group: { children: unknown[] }) => group.children as InstancedMesh[]

describe('plantVariants', () => {
  it('AC-1: groups the parcel indexes by variety and stage', () => {
    const variants = plantVariants(plants, HOUR)
    expect(Object.fromEntries(variants)).toEqual({
      'robusta/setzling': [3 * world.size + 4, 3 * world.size + 5],
      'robusta/reif': [7 * world.size + 2],
      'arabicaStandard/bluete': [8 * world.size + 9],
    })
    expect(plantVariants({}, HOUR).size).toBe(0)
  })
})

describe('createPlants', () => {
  it('AC-2: sets the instance count of each variant mesh', () => {
    const { group, show } = createPlants(world)
    expect(meshesOf(group)).toHaveLength(Object.keys(balance().varieties).length * STAGES.length)
    show(plants, HOUR)
    const expected: Record<string, number> = {
      'robusta/setzling': 2,
      'robusta/reif': 1,
      'arabicaStandard/bluete': 1,
    }
    for (const mesh of meshesOf(group)) expect(mesh.count).toBe(expected[mesh.name] ?? 0)
    show({}, HOUR)
    for (const mesh of meshesOf(group)) expect(mesh.count).toBe(0)
  })

  it('AC-3: puts each instance on its parcel center, above the field mark', () => {
    const { group, show } = createPlants(world)
    show(plants, HOUR)
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
    const one = { 0: { variety: 'robusta', plantedHour: 0 } as PlantState }
    // Robusta: wachstum starts at 0.25 of 3 days (hour 18), bluete at 0.6 (hour 43.2).
    expect(plantsKey(one, 20)).toBe(plantsKey(one, 40))
    expect(plantsKey(one, 44)).not.toBe(plantsKey(one, 40))
    const two = { ...one, 1: { variety: 'robusta', plantedHour: 0 } as PlantState }
    expect(plantsKey(two, 40)).not.toBe(plantsKey(one, 40))
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
