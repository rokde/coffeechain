import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import type { FarmState } from '../sim/farm/parcels'
import { generateWorld } from '../sim/world/generate'
import {
  BORDER_LIFT,
  createFieldBorders,
  createFieldMarks,
  FIELD_LABEL_STYLE,
  fieldAnchors,
  fieldEdges,
  hoveredField,
} from './fields'
import { buildingTop } from './buildings'
import { corner, createOutline, parcelAt } from './picking'
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

describe('fieldEdges (#11)', () => {
  it('gives the 4 edges of a single parcel and only the outer edges of a merged field', () => {
    const edges = fieldEdges(threeFields, n)
    const of = (x: number, y: number) => edges.filter(([index]) => index === at(x, y))
    expect(of(10, 10)).toHaveLength(4)
    expect(of(30, 12)).toHaveLength(4)
    // Field C is an L: (20, 20) shares its right edge, (21, 21) its top edge, (21, 20) both.
    expect(of(20, 20).map(([, a, b]) => [a, b])).not.toContainEqual([1, 2])
    expect(of(21, 21).map(([, a, b]) => [a, b])).not.toContainEqual([0, 1])
    expect(of(21, 20)).toHaveLength(2)
    expect(edges).toHaveLength(16)
  })

  it('keeps the edge between two touching parcels of different fields', () => {
    const two = farm({ [at(5, 5)]: 0, [at(6, 5)]: 1 }, [
      { id: 0, name: 'A' },
      { id: 1, name: 'B' },
    ])
    expect(fieldEdges(two, n)).toHaveLength(8)
  })

  it('gives no edges for an empty farm', () => {
    expect(fieldEdges(farm({}, []), n)).toEqual([])
  })
})

describe('createFieldBorders (#11)', () => {
  const terrain = createTerrain(world)
  const corners = terrain.geometry.getAttribute('position')
  // Builds the borders of the farm and gives vertex v as [x, y, z].
  const build = (f: FarmState) => {
    const { mesh, show } = createFieldBorders(terrain, n)
    show(f)
    const position = mesh.geometry.getAttribute('position')
    const vertex = (v: number) => [position.getX(v), position.getY(v), position.getZ(v)]
    return { mesh, position, vertex }
  }
  // The field mark surface at corner c of parcel index, or BORDER_WIDTH of the way to corner to.
  const mark = (index: number, c: number, to = c) => {
    const [from, end] = [corner(corners, 4 * index + c), corner(corners, 4 * index + to)]
    return from.map((v, k) => v + (end[k]! - v) * (c === to ? 0 : 0.16))
  }

  it('has one strip per outer edge above the field mark, and none for no parcels', () => {
    const { mesh, position, vertex } = build(threeFields)
    const edges = fieldEdges(threeFields, n)
    expect(position.count).toBe(4 * edges.length)
    expect(mesh.geometry.getIndex()!.count).toBe(6 * edges.length)
    edges.forEach(([index, a, b], e) => {
      // Outer corners, then the inner corners on the two quad sides next to the edge.
      const expected = [
        mark(index, a),
        mark(index, b),
        mark(index, b, (b + 1) % 4),
        mark(index, a, (a + 3) % 4),
      ]
      expected.forEach(([x, y, z], i) => {
        const [vx, vy, vz] = vertex(4 * e + i)
        expect(vx).toBeCloseTo(x!, 5)
        expect(vz).toBeCloseTo(z!, 5)
        expect(vy).toBeCloseTo(y! + BORDER_LIFT, 5)
      })
      // The middle of the inner side lies inside the parcel.
      const [x2, , z2] = vertex(4 * e + 2)
      const [x3, , z3] = vertex(4 * e + 3)
      const middle = { x: (x2! + x3!) / 2, z: (z2! + z3!) / 2 }
      expect(parcelAt(middle, n)).toEqual({ x: index % n, y: Math.floor(index / n) })
    })

    expect(build(farm({}, [])).position.count).toBe(0)
  })

  it('joins collinear strips of one field without a gap', () => {
    // The top edges of (20, 20) and (21, 20) in field C meet at the corner x = 21.
    const { vertex } = build(threeFields)
    const edges = fieldEdges(threeFields, n)
    const strip = (x: number, y: number) =>
      edges.findIndex(([index, a, b]) => index === at(x, y) && a === 0 && b === 1)
    const left = strip(20, 20)
    const right = strip(21, 20)
    expect(vertex(4 * left + 1)).toEqual(vertex(4 * right))
    expect(vertex(4 * left + 2)).toEqual(vertex(4 * right + 3))
  })

  it('has faces that point up', () => {
    const { mesh, vertex } = build(threeFields)
    const index = mesh.geometry.getIndex()!
    for (let t = 0; t < index.count; t += 3) {
      const [p, q, r] = [0, 1, 2].map((i) => vertex(index.getX(t + i)))
      const [ux, , uz] = q!.map((v, k) => v - p![k]!)
      const [vx, , vz] = r!.map((v, k) => v - p![k]!)
      // The y part of the face normal (q - p) × (r - p).
      expect(uz! * vx! - ux! * vz!).toBeGreaterThan(0)
    }
  })

  it('lies below the selection outline', () => {
    const { vertex } = build(threeFields)
    const [index, a] = fieldEdges(threeFields, n)[0]!
    const outline = createOutline(terrain, n)
    outline.show({ x: index % n, y: Math.floor(index / n) })
    const y = outline.line.geometry.getAttribute('position').getY(a)
    expect(y).toBeGreaterThan(vertex(0)[1]!)
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
