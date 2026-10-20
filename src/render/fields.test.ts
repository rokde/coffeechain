import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import type { FarmState } from '../sim/farm/parcels'
import { generateWorld } from '../sim/world/generate'
import { createFieldMarks, fieldAnchors } from './fields'
import { createTerrain } from './terrain'
import { parcelCenter } from './surface'

const world = generateWorld(42, balance())
const n = world.size
const at = (x: number, y: number) => y * n + x

const farm = (parcels: Record<number, number>, fields: FarmState['fields']): FarmState => ({
  parcels,
  fields,
  nextFieldId: fields.length,
  plants: {},
})

// Field A and B have one parcel each. Field C is the merge of three parcels in an L.
const threeFields = farm(
  {
    [at(10, 10)]: 0,
    [at(30, 12)]: 1,
    [at(20, 20)]: 2,
    [at(21, 20)]: 2,
    [at(21, 21)]: 2,
  },
  [
    { id: 0, name: 'A' },
    { id: 1, name: 'B' },
    { id: 2, name: 'C' },
  ],
)

describe('fieldAnchors', () => {
  it('AC-1: gives one entry per field at the mean parcel center', () => {
    const mean = (cells: [number, number][]) => {
      const c = cells.map(([x, y]) => parcelCenter(world, x, y))
      const avg = (k: 'x' | 'y' | 'z') => c.reduce((s, p) => s + p[k], 0) / c.length
      return { x: avg('x'), y: avg('y'), z: avg('z') }
    }
    const anchors = fieldAnchors(world, threeFields)
    expect(anchors.map(({ id, name }) => ({ id, name }))).toEqual(threeFields.fields)
    expect(anchors[0]!.position).toEqual(parcelCenter(world, 10, 10))
    expect(anchors[1]!.position).toEqual(parcelCenter(world, 30, 12))
    const merged = mean([
      [20, 20],
      [21, 20],
      [21, 21],
    ])
    for (const k of ['x', 'y', 'z'] as const) {
      expect(anchors[2]!.position[k]).toBeCloseTo(merged[k], 10)
    }
  })

  it('AC-1: gives an empty list for an empty farm', () => {
    expect(fieldAnchors(world, farm({}, []))).toEqual([])
  })
})

describe('createFieldMarks', () => {
  it('AC-2: has one quad on the terrain corners per owned parcel, and none for no parcels', () => {
    const terrain = createTerrain(world)
    const corners = terrain.geometry.getAttribute('position')
    const { mesh, show } = createFieldMarks(terrain)
    show(threeFields)
    const position = mesh.geometry.getAttribute('position')
    const owned = Object.keys(threeFields.parcels).map(Number)
    expect(position.count).toBe(4 * owned.length)
    expect(mesh.geometry.getIndex()!.count).toBe(6 * owned.length)
    owned.forEach((index, q) => {
      for (let i = 0; i < 4; i++) {
        const v = 4 * q + i
        const c = 4 * index + i
        expect(position.getX(v)).toBe(corners.getX(c))
        expect(position.getZ(v)).toBe(corners.getZ(c))
        expect(position.getY(v)).toBeGreaterThan(corners.getY(c))
      }
    })

    show(farm({}, []))
    expect(mesh.geometry.getAttribute('position').count).toBe(0)
  })
})
