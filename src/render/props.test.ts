import {
  Box3,
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector3,
  type Object3D,
} from 'three'
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
  if (id.startsWith('tree')) {
    // Two mesh parts with own local transforms: a trunk and a crown above it.
    const trunk = new Mesh(new BoxGeometry(0.1, 0.6, 0.1))
    trunk.position.set(0.05, 0.3, 0)
    const crown = new Mesh(new BoxGeometry(0.25, 0.5, 0.2))
    crown.position.set(0.1, 0.85, -0.05)
    crown.scale.setScalar(2)
    const tree = new Group().add(trunk, crown)
    tree.scale.setScalar(0.8)
    return tree
  }
  return new Mesh(new BoxGeometry(2, 0.74, 2).translate(0.3, 0.2, -0.1))
}
const widths: Record<string, number> = {
  hut: 0.9,
  'market-stand': 0.8,
  'tree-a': 0.7,
  'tree-b': 0.7,
  'tree-c': 0.7,
}

// Places of the non-tree children with their model id.
const placesOf = (group: { children: Object3D[] }, pred: (id: string) => boolean) =>
  group.children
    .filter((c) => !(c instanceof InstancedMesh))
    .map((c) => c.userData as { prop: string; x: number; y: number })
    .filter((d) => pred(d.prop))
    .map(({ x, y }) => ({ x, y }))
const treeMeshes = (group: { children: Object3D[] }) =>
  group.children.filter((c): c is InstancedMesh => c instanceof InstancedMesh)
const treeData = (mesh: InstancedMesh) => mesh.userData as { prop: string; places: Place[] }
// The tree places of the first mesh part of each model, so each tree once.
const treePlaces = (group: { children: Object3D[] }) => {
  const seen = new Set<string>()
  return treeMeshes(group)
    .filter((m) => !seen.has(treeData(m).prop) && seen.add(treeData(m).prop))
    .flatMap((m) => treeData(m).places)
}
const sortPlaces = (list: readonly Place[]) => [...list].sort((a, b) => a.x - b.x || a.y - b.y)
const modelOf = (p: Place) => ['tree-a', 'tree-b', 'tree-c'][(p.x + p.y) % 3]!

describe('createProps', () => {
  it('S10c AC-1 and AC-2: draws exactly the trees of the given props', async () => {
    const extra = { ...places, trees: [...places.trees.slice(1), { x: 0, y: 0 }] }
    const group = await createProps(world, extra, fakeLoad)
    expect(sortPlaces(treePlaces(group))).toEqual(sortPlaces(extra.trees))
    expect(treePlaces(group)).not.toContainEqual(places.trees[0])
    expect(placesOf(group, (id) => id === 'hut')).toEqual([places.hut])
    expect(placesOf(group, (id) => id === 'market-stand')).toEqual([places.market])
  })

  it('S54b AC-1: draws each mesh part of each used tree model as one InstancedMesh', async () => {
    const group = await createProps(world, places, fakeLoad)
    const plain = group.children.filter(
      (c) => !(c instanceof InstancedMesh) && (c.userData.prop as string).startsWith('tree'),
    )
    expect(plain).toEqual([])
    const used = new Set(places.trees.map(modelOf))
    expect(used.size).toBe(3)
    for (const id of used) {
      expect(treeMeshes(group).filter((m) => treeData(m).prop === id)).toHaveLength(2)
    }
    expect(treeMeshes(group)).toHaveLength(2 * used.size)
  })

  it('S54b AC-2: keeps the number of tree meshes for many more trees', async () => {
    const all: Place[] = []
    for (let x = 0; x < world.size; x++) for (let y = 0; y < world.size; y++) all.push({ x, y })
    const few = await createProps(world, places, fakeLoad)
    const many = await createProps(world, { ...places, trees: all }, fakeLoad)
    expect(treeMeshes(many)).toHaveLength(treeMeshes(few).length)
    for (const [group, trees] of [
      [few, places.trees],
      [many, all],
    ] as const) {
      for (const part of [0, 1]) {
        const meshes = treeMeshes(group).filter((_, i) => i % 2 === part)
        expect(meshes.reduce((sum, m) => sum + m.count, 0)).toBe(trees.length)
      }
      for (const m of treeMeshes(group)) {
        expect(m.count).toBe(treeData(m).places.length)
        expect(treeData(m).places.every((p) => modelOf(p) === treeData(m).prop)).toBe(true)
      }
      expect(sortPlaces(treePlaces(group))).toEqual(sortPlaces(trees))
    }
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
      expect(treeMeshes(group).length).toBeGreaterThan(0)
    }
  })

  it('AC-3: puts hut, market and trees at the places for seed 42', async () => {
    const group = await createProps(world, places, fakeLoad)
    expect(placesOf(group, (id) => id === 'hut')).toEqual([places.hut])
    expect(placesOf(group, (id) => id === 'market-stand')).toEqual([places.market])
    expect(placesOf(group, (id) => id.startsWith('path'))).toEqual([])
    expect(sortPlaces(treePlaces(group))).toEqual(sortPlaces(places.trees))
    expect(places.trees.length).toBeGreaterThan(0)
    const again = await createProps(world, places, fakeLoad)
    expect(again.children.map((c) => c.userData)).toEqual(group.children.map((c) => c.userData))
  })

  it('AC-4 and AC-5: scales each model to its width and sets it on the parcel surface', async () => {
    const group = await createProps(world, places, fakeLoad)
    group.updateMatrixWorld(true)
    const expectOnParcel = (box: Box3, prop: string, x: number, y: number) => {
      const size = box.getSize(new Vector3())
      const center = box.getCenter(new Vector3())
      const surface = parcelCenter(world, x, y)
      expect(Math.max(size.x, size.z)).toBeCloseTo(widths[prop]!, 3)
      expect(box.min.y).toBeCloseTo(surface.y, 3)
      expect(center.x).toBeCloseTo(surface.x, 3)
      expect(center.z).toBeCloseTo(surface.z, 3)
    }
    for (const child of group.children) {
      if (child instanceof InstancedMesh) continue
      const { prop, x, y } = child.userData as { prop: string; x: number; y: number }
      expectOnParcel(new Box3().setFromObject(child), prop, x, y)
    }
    // S54b AC-3: the box of one tree is the union of its mesh parts under their instance matrices.
    const boxes = new Map<string, Box3>()
    const matrix = new Matrix4()
    for (const mesh of treeMeshes(group)) {
      mesh.geometry.computeBoundingBox()
      treeData(mesh).places.forEach((p, i) => {
        mesh.getMatrixAt(i, matrix)
        const part = mesh.geometry.boundingBox!.clone().applyMatrix4(matrix)
        const key = `${p.x},${p.y}`
        boxes.set(key, boxes.get(key)?.union(part) ?? part)
      })
    }
    expect(boxes.size).toBe(places.trees.length)
    for (const p of places.trees) expectOnParcel(boxes.get(`${p.x},${p.y}`)!, modelOf(p), p.x, p.y)
  })
})

describe('syncTrees', () => {
  const expectSynced = (group: Group, rest: readonly Place[]) => {
    expect(sortPlaces(treePlaces(group))).toEqual(sortPlaces(rest))
    for (const m of treeMeshes(group)) expect(m.count).toBe(treeData(m).places.length)
  }

  it('S10c AC-3 and S54b AC-4: removes only the tree that left the list', async () => {
    const group = await createProps(world, places, fakeLoad)
    const [gone, ...rest] = places.trees as [Place, ...Place[]]
    const before = [...group.children]
    const matrices = new Map<string, Matrix4>()
    for (const m of treeMeshes(group)) {
      treeData(m).places.forEach((p, i) => {
        matrices.set(`${m.uuid}/${p.x},${p.y}`, m.getMatrixAt(i, new Matrix4()))
      })
    }
    syncTrees(group, rest)
    expect(group.children).toHaveLength(before.length)
    expect(group.children.every((c, i) => c === before[i])).toBe(true)
    expect(treePlaces(group)).not.toContainEqual(gone)
    expectSynced(group, rest)
    for (const m of treeMeshes(group)) {
      treeData(m).places.forEach((p, i) => {
        expect(m.getMatrixAt(i, new Matrix4())).toEqual(matrices.get(`${m.uuid}/${p.x},${p.y}`))
      })
    }
  })

  it('S10c AC-4: drops the tree of a parcel bought with CreateParcels', async () => {
    const state = createState(42)
    const tree = state.props.trees.find((t) => isBuildable(state.world, t.x, t.y))!
    expect(tree).toBeDefined()
    const group = await createProps(state.world, state.props, fakeLoad)
    expect(treePlaces(group)).toContainEqual(tree)
    const next = dispatch(state, { type: 'CreateParcels', parcels: [tree] })
    syncTrees(group, next.props.trees)
    expect(treePlaces(group)).not.toContainEqual(tree)
    expectSynced(group, next.props.trees)
  })
})
