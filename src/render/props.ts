import { Box3, Group, InstancedMesh, Matrix4, Mesh, Vector3, type Object3D } from 'three'
import type { Place, WorldProps } from '../sim/world/props'
import type { World } from '../sim/world/types'
import type { ModelId } from './models'
import { parcelCenter } from './surface'

// Render constants, not balancing numbers: the larger footprint side in parcels.
const WIDTHS: Partial<Record<ModelId, number>> = {
  hut: 0.9,
  'market-stand': 0.8,
  'tree-a': 0.7,
  'tree-b': 0.7,
  'tree-c': 0.7,
}
const TREES = ['tree-a', 'tree-b', 'tree-c'] as const

export async function createProps(
  world: World,
  props: WorldProps,
  load: (id: ModelId) => Promise<Object3D>,
): Promise<Group> {
  // The path is a ribbon on the terrain, see path.ts.
  const items: { id: ModelId; x: number; y: number }[] = [
    { id: 'hut', ...props.hut },
    { id: 'market-stand', ...props.market },
  ]

  const group = new Group()
  const models = await Promise.all(items.map((item) => load(item.id)))
  items.forEach(({ id, x, y }, i) => {
    const model = models[i]!
    const size = new Box3().setFromObject(model).getSize(new Vector3())
    model.scale.multiplyScalar(WIDTHS[id]! / Math.max(size.x, size.z))
    // shortcut: flat base at the parcel center, on slopes a corner can sink or float; tilt to the slope when it looks wrong
    const box = new Box3().setFromObject(model)
    const center = parcelCenter(world, x, y)
    model.position.x += center.x - (box.min.x + box.max.x) / 2
    model.position.y += center.y - box.min.y
    model.position.z += center.z - (box.min.z + box.max.z) / 2
    model.userData = { prop: id, x, y }
    group.add(model)
  })

  // One InstancedMesh for each mesh part of each tree model, so the draw calls do not grow with the trees.
  for (const id of TREES) {
    const places = props.trees.filter((p) => TREES[(p.x + p.y) % 3] === id)
    if (places.length === 0) continue
    const model = await load(id)
    model.updateMatrixWorld(true)
    const box = new Box3().setFromObject(model)
    const size = box.getSize(new Vector3())
    const scale = WIDTHS[id]! / Math.max(size.x, size.z)
    box.min.multiplyScalar(scale)
    box.max.multiplyScalar(scale)
    // The same flat base as the clones above.
    const placements = places.map(({ x, y }) => {
      const center = parcelCenter(world, x, y)
      return new Matrix4()
        .makeTranslation(
          center.x - (box.min.x + box.max.x) / 2,
          center.y - box.min.y,
          center.z - (box.min.z + box.max.z) / 2,
        )
        .multiply(new Matrix4().makeScale(scale, scale, scale))
    })
    const parts: Mesh[] = []
    model.traverse((o) => {
      if (o instanceof Mesh) parts.push(o)
    })
    for (const part of parts) {
      const mesh = new InstancedMesh(part.geometry, part.material, places.length)
      const matrix = new Matrix4()
      placements.forEach((placement, i) => {
        mesh.setMatrixAt(i, matrix.multiplyMatrices(placement, part.matrixWorld))
      })
      mesh.computeBoundingSphere()
      mesh.userData = { prop: id, places }
      group.add(mesh)
    }
  }
  return group
}

// Removes the tree instances without a place in trees. Nothing adds trees yet, so this only removes.
export function syncTrees(group: Group, trees: readonly Place[]): void {
  const keep = new Set(trees.map((t) => `${t.x},${t.y}`))
  const matrix = new Matrix4()
  for (const mesh of group.children) {
    if (!(mesh instanceof InstancedMesh)) continue
    const data = mesh.userData as { prop: string; places: Place[] }
    const places: Place[] = []
    data.places.forEach((p, i) => {
      if (!keep.has(`${p.x},${p.y}`)) return
      mesh.setMatrixAt(places.length, mesh.getMatrixAt(i, matrix))
      places.push(p)
    })
    if (places.length === data.places.length) continue
    mesh.userData = { prop: data.prop, places }
    mesh.count = places.length
    mesh.instanceMatrix.needsUpdate = true
    // The renderer culls with the bounding sphere, so it must follow the remaining instances.
    mesh.computeBoundingSphere()
  }
}
