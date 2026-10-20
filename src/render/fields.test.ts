import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import type { FarmState } from '../sim/farm/parcels'
import { generateWorld } from '../sim/world/generate'
import { createFieldMarks, FIELD_LABEL_STYLE, fieldAnchors, hoveredField } from './fields'
import { buildingTop } from './buildings'
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

  it('raises the anchor of a field with a building to the building top', () => {
    const anchors = fieldAnchors(world, threeFields, {
      [at(10, 10)]: { kind: 'processing' },
      [at(21, 21)]: { kind: 'storage' },
    })
    expect(buildingTop('processing')).toBeGreaterThan(0.4)
    expect(anchors[0]!.position.y).toBeCloseTo(
      parcelCenter(world, 10, 10).y + buildingTop('processing'),
      10,
    )
    expect(anchors[1]!.position).toEqual(parcelCenter(world, 30, 12))
    expect(anchors[2]!.position.y).toBeCloseTo(
      Math.max(
        fieldAnchors(world, threeFields)[2]!.position.y,
        parcelCenter(world, 21, 21).y + buildingTop('storage'),
      ),
      10,
    )
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

describe('hoveredField', () => {
  // Label A at 100..160 x 50..70, label C at 300..360 x 50..70.
  const labels = [
    { id: 0, box: { left: 100, top: 50, right: 160, bottom: 70 } },
    { id: 2, box: { left: 300, top: 50, right: 360, bottom: 70 } },
  ]
  const outside = { x: 500, y: 500 }

  it('AC-1: gives the field of the label under the pointer, before the hovered parcel', () => {
    expect(hoveredField(null, threeFields, n, { x: 130, y: 60 }, labels)).toBe(0)
    expect(hoveredField({ x: 30, y: 12 }, threeFields, n, { x: 300, y: 70 }, labels)).toBe(2)
    expect(hoveredField({ x: 5, y: 5 }, threeFields, n, { x: 160, y: 50 }, labels)).toBe(0)
  })

  it('AC-2: gives the field of the hovered parcel when no label is under the pointer', () => {
    expect(hoveredField({ x: 10, y: 10 }, threeFields, n, outside, labels)).toBe(0)
    expect(hoveredField({ x: 21, y: 21 }, threeFields, n, outside, labels)).toBe(2)
    expect(hoveredField({ x: 30, y: 12 }, threeFields, n, outside, [])).toBe(1)
  })

  it('AC-3: gives null when no label is under the pointer and the parcel has no field', () => {
    expect(hoveredField(null, threeFields, n, outside, labels)).toBeNull()
    expect(hoveredField({ x: 5, y: 5 }, threeFields, n, outside, labels)).toBeNull()
    expect(hoveredField({ x: 5, y: 5 }, farm({}, []), n, { x: 130, y: 60 }, [])).toBeNull()
  })
})

describe('FIELD_LABEL_STYLE', () => {
  it('AC-4: has a font of 12px or less and an opacity transition', () => {
    const size = Number(/(\d+(?:\.\d+)?)px\s+system-ui/.exec(FIELD_LABEL_STYLE)![1])
    expect(size).toBeLessThanOrEqual(12)
    expect(FIELD_LABEL_STYLE).toMatch(/transition:\s*opacity/)
  })
})
