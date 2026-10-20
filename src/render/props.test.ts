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
import { createProps, pathPieces, syncTrees } from './props'
import { parcelCenter } from './surface'

const world = generateWorld(42, balance())
const places = placeProps(world, balance())
// The lowest seed from 1 upward with a corner in the path. The S6 e2e test uses it too.
const CORNER_SEED = 7

// Hut-like and tree-like boxes of different sizes. Path tiles have their top 0.05 below the origin.
const fakeLoad = async (id: ModelId): Promise<Object3D> => {
  if (id.startsWith('path')) return new Mesh(new BoxGeometry(1, 0.05, 1).translate(0, -0.075, 0))
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
    expect(placesOf(group, (id) => id.startsWith('path'))).toEqual(places.path.slice(1, -1))
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

  it('AC-3: puts hut, market, path pieces and trees at the places for seed 42', async () => {
    const group = await createProps(world, places, fakeLoad)
    expect(placesOf(group, (id) => id === 'hut')).toEqual([places.hut])
    expect(placesOf(group, (id) => id === 'market-stand')).toEqual([places.market])
    expect(placesOf(group, (id) => id.startsWith('path'))).toEqual(places.path.slice(1, -1))
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
