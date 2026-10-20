import { existsSync, readFileSync } from 'node:fs'
import { Object3D } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createModelCache, MODEL_FILES, MODEL_IDS, type ModelId } from './models'

describe('model list', () => {
  it('maps each id to a file in assets/kenney/', () => {
    expect(MODEL_IDS).toHaveLength(9)
    for (const file of Object.values(MODEL_FILES)) {
      expect(existsSync(`assets/kenney/${file}`), file).toBe(true)
    }
  })

  it('has a CC0 license file', () => {
    expect(readFileSync('assets/kenney/License.txt', 'utf8')).toContain('CC0')
  })
})

describe('loadModel', () => {
  const fakeLoader = () => ({
    loadAsync: vi.fn(async () => ({ scene: new Object3D() })),
  })

  it('loads each file one time and gives a new clone per call', async () => {
    const loader = fakeLoader()
    const { loadModel } = createModelCache(loader)
    const a = await loadModel('hut')
    const b = await loadModel('hut')
    expect(loader.loadAsync).toHaveBeenCalledTimes(1)
    expect(a).toBeInstanceOf(Object3D)
    expect(b).toBeInstanceOf(Object3D)
    expect(a).not.toBe(b)
  })

  it('rejects an unknown id with an error that names the id', async () => {
    const { loadModel } = createModelCache(fakeLoader())
    await expect(loadModel('castle' as ModelId)).rejects.toThrow('castle')
  })

  it('preloads every id one time', async () => {
    const loader = fakeLoader()
    const { loadModel, preloadModels } = createModelCache(loader)
    await preloadModels()
    await loadModel('rock-a')
    expect(loader.loadAsync).toHaveBeenCalledTimes(MODEL_IDS.length)
  })
})
