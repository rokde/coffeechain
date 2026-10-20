import { Box3, Group, Vector3, type Object3D } from 'three'
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
    // shortcut: one clone per tree, switch to InstancedMesh when the fps drops (S36)
    ...props.trees.map((p) => ({ id: TREES[(p.x + p.y) % 3]!, ...p })),
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
  return group
}

// Removes each tree child without a place in trees. Nothing adds trees yet, so this only removes.
export function syncTrees(group: Group, trees: readonly Place[]): void {
  const keep = new Set(trees.map((t) => `${t.x},${t.y}`))
  const gone = group.children.filter((c) => {
    const { prop, x, y } = c.userData as { prop: string; x: number; y: number }
    return prop.startsWith('tree') && !keep.has(`${x},${y}`)
  })
  group.remove(...gone)
}
