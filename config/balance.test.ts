import { describe, expect, it } from 'vitest'
import raw from './balance.json'
import { loadBalance } from './balance.schema'

// Collects the path of each {v, src} leaf and its src value.
function leaves(node: unknown, path: string[] = []): { path: string; src: unknown }[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return [{ path: path.join('.'), src: undefined }]
  }
  if ('v' in node) return [{ path: path.join('.'), src: (node as { src?: unknown }).src }]
  return Object.entries(node).flatMap(([key, child]) =>
    key === '_format' ? [] : leaves(child, [...path, key]),
  )
}

const copy = () => structuredClone(raw) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

describe('balance.json', () => {
  it('loads through the schema', () => {
    const balance = loadBalance(raw)
    expect(balance.time.ticksPerGameDay).toBe(24)
    expect(balance.varieties.robusta.careCost.fertilizer).toBe(1)
  })

  it('has a non-empty string src on every value', () => {
    const all = leaves(raw)
    expect(all.length).toBeGreaterThan(50)
    const bad = all.filter((l) => typeof l.src !== 'string' || l.src.trim() === '')
    expect(bad.map((l) => l.path)).toEqual([])
  })

  it('names the path of a value with the wrong type', () => {
    const cfg = copy()
    cfg.time.ticksPerGameDay.v = 'x'
    expect(() => loadBalance(cfg)).toThrow('time.ticksPerGameDay.v')
  })

  it('names the path of a missing src', () => {
    const cfg = copy()
    delete cfg.varieties.robusta.seedCost.src
    expect(() => loadBalance(cfg)).toThrow('varieties.robusta.seedCost.src')
  })
})
