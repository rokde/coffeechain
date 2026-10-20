import { Box3, BoxGeometry, Mesh, Vector3, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { dispatch } from '../sim/commands'
import { isBuildable } from '../sim/farm/parcels'
import { createState } from '../sim/state'
import { generateWorld } from '../sim/world/generate'
import { placeProps, type Place } from '../sim/world/props'
import type { ModelId } from './models'
import { createProps, syncTrees } from './props'
import { parcelCenter } from './surface'

const world = generateWorld(42, balance())
const places = placeProps(world, balance())

// Hut-like and tree-like boxes of different sizes.
const fakeLoad = async (id: ModelId): Promise<Object3D> => {
  if (id.startsWith('tree')) return new Mesh(new BoxGeometry(0.5, 1.71, 0.5))
  return new Mesh(new BoxGeometry(2, 0.74, 2).translate(0.3, 0.2, -0.1))
}
const widths: Record<string, number> = {
  hut: 0.9,
  'market-stand': 0.8,
  'tree-a': 0.7,
  'tree-b': 0.7,
  'tree-c': 0.7,
}

const placesOf = (group: { children: Object3D[] }, pred: (id: string) => boolean) =>
  group.children
    .map((c) => c.userData as { prop: string; x: number; y: number })
    .filter((d) => pred(d.prop))
    .map(({ x, y }) => ({ x, y }))
const isTree = (id: string) => id.startsWith('tree')

describe('createProps', () => {
  it('S10c AC-1 and AC-2: draws exactly the trees of the given props', async () => {
    const extra = { ...places, trees: [...places.trees.slice(1), { x: 0, y: 0 }] }
    const group = await createProps(world, extra, fakeLoad)
    expect(placesOf(group, isTree)).toEqual(extra.trees)
    expect(placesOf(group, isTree)).not.toContainEqual(places.trees[0])
    expect(placesOf(group, (id) => id === 'hut')).toEqual([places.hut])
    expect(placesOf(group, (id) => id === 'market-stand')).toEqual([places.market])
  })

  it('S40b AC-4: places no path model, but the hut, the market and the trees', async () => {
    for (const seed of [42, 7]) {
      const w = generateWorld(seed, balance())
      const group = await createProps(w, placeProps(w, balance()), fakeLoad)
      const ids = group.children.map((c) => (c.userData as { prop: string }).prop)
      expect(ids).not.toContain('path-straight')
      expect(ids).not.toContain('path-corner')
      expect(ids.filter((id) => id === 'hut')).toHaveLength(1)
      expect(ids.filter((id) => id === 'market-stand')).toHaveLength(1)
      expect(ids.filter(isTree).length).toBeGreaterThan(0)
    }
  })

  it('AC-3: puts hut, market and trees at the places for seed 42', async () => {
    const group = await createProps(world, places, fakeLoad)
    const data = group.children.map((c) => c.userData)
    const of = (pred: (id: string) => boolean) =>
      data.filter((d) => pred(d.prop as string)).map(({ x, y }) => ({ x, y }))
    expect(of((id) => id === 'hut')).toEqual([places.hut])
    expect(of((id) => id === 'market-stand')).toEqual([places.market])
    expect(of((id) => id.startsWith('path'))).toEqual([])
    expect(of((id) => id.startsWith('tree'))).toEqual(places.trees)
    expect(places.trees.length).toBeGreaterThan(0)
    for (const d of data.filter((d) => (d.prop as string).startsWith('tree'))) {
      expect(['tree-a', 'tree-b', 'tree-c']).toContain(d.prop)
    }
    const again = await createProps(world, places, fakeLoad)
    expect(again.children.map((c) => c.userData)).toEqual(data)
  })

  it('AC-4 and AC-5: scales each model to its width and sets it on the parcel surface', async () => {
    const group = await createProps(world, places, fakeLoad)
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

describe('syncTrees', () => {
  it('S10c AC-3: removes only the tree that left the list', async () => {
    const group = await createProps(world, places, fakeLoad)
    const [gone, ...rest] = places.trees as [Place, ...Place[]]
    const kept = group.children.filter((c) => {
      const { prop, x, y } = c.userData as { prop: string; x: number; y: number }
      return !(isTree(prop) && x === gone.x && y === gone.y)
    })
    syncTrees(group, rest)
    expect(group.children).toHaveLength(kept.length)
    expect(group.children.every((c, i) => c === kept[i])).toBe(true)
    expect(placesOf(group, isTree)).not.toContainEqual(gone)
    expect(placesOf(group, isTree)).toEqual(rest)
  })

  it('S10c AC-4: drops the tree of a parcel bought with CreateParcels', async () => {
    const state = createState(42)
    const tree = state.props.trees.find((t) => isBuildable(state.world, t.x, t.y))!
    expect(tree).toBeDefined()
    const group = await createProps(state.world, state.props, fakeLoad)
    expect(placesOf(group, isTree)).toContainEqual(tree)
    const next = dispatch(state, { type: 'CreateParcels', parcels: [tree] })
    syncTrees(group, next.props.trees)
    expect(placesOf(group, isTree)).not.toContainEqual(tree)
    expect(placesOf(group, isTree)).toEqual(next.props.trees)
  })
})
