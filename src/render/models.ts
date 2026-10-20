import type { Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Each id maps to one file in assets/kenney/. The kit name is in the file prefix.
export const MODEL_FILES = {
  hut: 'city-building-type-h.glb',
  'market-stand': 'fantasy-stall-red.glb',
  'path-straight': 'nature-ground_pathStraight.glb',
  'path-corner': 'nature-ground_pathBend.glb',
  'tree-a': 'nature-tree_default.glb',
  'tree-b': 'nature-tree_oak.glb',
  'tree-c': 'nature-tree_palmTall.glb',
  'rock-a': 'survival-rock-a.glb',
  'rock-b': 'survival-rock-b.glb',
} as const

export type ModelId = keyof typeof MODEL_FILES
export const MODEL_IDS = Object.keys(MODEL_FILES) as ModelId[]

const urls = import.meta.glob<string>('/assets/kenney/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
})

export interface ModelLoader {
  loadAsync(url: string): Promise<{ scene: Object3D }>
}

export function createModelCache(loader: ModelLoader) {
  const cache = new Map<string, Promise<Object3D>>()

  function load(id: string): Promise<Object3D> {
    const file = (MODEL_FILES as Record<string, string>)[id]
    const url = file && urls[`/assets/kenney/${file}`]
    if (!url) return Promise.reject(new Error(`Unknown model id: ${id}`))
    let entry = cache.get(id)
    if (!entry) {
      entry = loader.loadAsync(url).then((gltf) => gltf.scene)
      // Drop a failed load, so that the next call can try again.
      entry.catch(() => cache.delete(id))
      cache.set(id, entry)
    }
    return entry
  }

  return {
    loadModel: (id: ModelId) => load(id).then((model) => model.clone()),
    preloadModels: () => Promise.all(MODEL_IDS.map(load)).then(() => undefined),
  }
}

export const { loadModel, preloadModels } = createModelCache(new GLTFLoader())
