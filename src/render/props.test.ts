import { Box3, BoxGeometry, Mesh, Vector3, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { generateWorld } from '../sim/world/generate'
import { placeProps } from '../sim/world/props'
import type { ModelId } from './models'
import { createProps, pathPieces } from './props'
import { parcelCenter } from './surface'

const world = generateWorld(42, balance())
const places = placeProps(world, balance())
// The lowest seed from 1 upward with a corner in the path. The S6 e2e test uses it too.
const CORNER_SEED = 7

// Hut-like and tree-like boxes of different sizes. Path tiles have their top 0.05 below the origin.
const fakeLoad = async (id: ModelId): Promise<Object3D> => {
  if (id.startsWith('path')) return new Mesh(new BoxGeometry(1, 0.05, 1).translate(0, -0.075, 0))
  if (id.startsWith('tree')) return new Mesh(new BoxGeometry(0.5, 1.71, 0.5))
  return new Mesh(new BoxGeometry(2, 0.74, 2).translate(0.3, 0.2, -0.1))
}
const widths: Record<string, number> = {
  hut: 0.9,
  'market-stand': 0.8,
  'path-straight': 1,
  'path-corner': 1,
  'tree-a': 0.7,
  'tree-b': 0.7,
  'tree-c': 0.7,
}

describe('pathPieces', () => {
  it('AC-2: gives no piece for a path of length 2', () => {
    expect(
      pathPieces([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toEqual([])
  })

  it('AC-2: turns straight pieces along x and along z by an odd number of quarters', () => {
    const alongX = pathPieces([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
    const alongZ = pathPieces([
      { x: 5, y: 3 },
      { x: 5, y: 2 },
      { x: 5, y: 1 },
    ])
    expect(alongX.map((p) => [p.x, p.y, p.model])).toEqual([
      [1, 0, 'path-straight'],
      [2, 0, 'path-straight'],
    ])
    expect(alongZ.map((p) => [p.x, p.y, p.model])).toEqual([[5, 2, 'path-straight']])
    expect(alongX[0]!.quarterTurns).toBe(alongX[1]!.quarterTurns)
    expect(Math.abs(alongX[0]!.quarterTurns - alongZ[0]!.quarterTurns) % 2).toBe(1)
  })

  it('AC-2: gives four different turns for the four corner shapes', () => {
    const corner = (dx: number, dy: number) => {
      const pieces = pathPieces([
        { x: 5 - dx, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 5 + dy },
      ])
      expect(pieces).toHaveLength(1)
      expect(pieces[0]).toMatchObject({ x: 5, y: 5, model: 'path-corner' })
      return pieces[0]!.quarterTurns
    }
    const turns = [corner(1, 1), corner(1, -1), corner(-1, 1), corner(-1, -1)]
    expect(new Set(turns).size).toBe(4)
    // The reverse direction gives the same shape.
    const back = pathPieces([
      { x: 5, y: 6 },
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ])
    expect(back[0]!.quarterTurns).toBe(turns[0])
  })

  it('AC-2: gives at least one corner piece for the corner seed', () => {
    const path = placeProps(generateWorld(CORNER_SEED, balance()), balance()).path
    expect(pathPieces(path).some((p) => p.model === 'path-corner')).toBe(true)
  })
})

describe('createProps', () => {
  it('AC-3: puts hut, market, path pieces and trees at the places for seed 42', async () => {
    const group = await createProps(world, fakeLoad)
    const data = group.children.map((c) => c.userData)
    const of = (pred: (id: string) => boolean) =>
      data.filter((d) => pred(d.prop as string)).map(({ x, y }) => ({ x, y }))
    expect(of((id) => id === 'hut')).toEqual([places.hut])
    expect(of((id) => id === 'market-stand')).toEqual([places.market])
    expect(of((id) => id.startsWith('path'))).toEqual(places.path.slice(1, -1))
    expect(of((id) => id.startsWith('tree'))).toEqual(places.trees)
    expect(places.trees.length).toBeGreaterThan(0)
    for (const d of data.filter((d) => (d.prop as string).startsWith('tree'))) {
      expect(['tree-a', 'tree-b', 'tree-c']).toContain(d.prop)
    }
    const again = await createProps(world, fakeLoad)
    expect(again.children.map((c) => c.userData)).toEqual(data)
  })

  it('AC-4 and AC-5: scales each model to its width and sets it on the parcel surface', async () => {
    const group = await createProps(world, fakeLoad)
    group.updateMatrixWorld(true)
    for (const child of group.children) {
      const { prop, x, y } = child.userData as { prop: string; x: number; y: number }
      const box = new Box3().setFromObject(child)
      const size = box.getSize(new Vector3())
      const center = box.getCenter(new Vector3())
      const surface = parcelCenter(world, x, y)
      expect(Math.max(size.x, size.z)).toBeCloseTo(widths[prop]!, 3)
      expect(box.min.y).toBeCloseTo(surface.y, 3)
      expect(center.x).toBeCloseTo(surface.x, 3)
      expect(center.z).toBeCloseTo(surface.z, 3)
    }
  })
})
