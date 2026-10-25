import { describe, expect, it } from 'vitest'
import raw from '../../../config/balance.json'
import { loadBalance } from '../../../config/balance.schema'
import { mulberry32 } from '../rng'
import { generateWorld } from './generate'
import { hashWorld } from './hash'
import type { Parcel, World } from './types'

const balance = loadBalance(raw)
const { size, startReach, startGuaranteeParcels } = balance.world

const random = mulberry32(2024)
const seeds = Array.from({ length: 200 }, () => Math.floor(random() * 2 ** 32))
const worlds = seeds.map((s) => generateWorld(s, balance))

const at = (w: World, x: number, y: number) => w.parcels[y * w.size + x]

// All parcels that pass `ok` and connect to `from` over 4-neighbours.
function group(w: World, from: Parcel, ok: (p: Parcel) => boolean): Parcel[] {
  const out = [from]
  const seen = new Set(out)
  for (let i = 0; i < out.length; i++) {
    const p = out[i]!
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = at(w, p.x + dx, p.y + dy)
      if (n && p.x + dx >= 0 && p.x + dx < w.size && !seen.has(n) && ok(n)) {
        seen.add(n)
        out.push(n)
      }
    }
  }
  return out
}

describe('generateWorld', () => {
  it('AC-1: gives the same world and hash for the same seed', () => {
    const a = generateWorld(7, balance)
    const b = generateWorld(7, balance)
    expect(a).toEqual(b)
    expect(hashWorld(a)).toBe(hashWorld(b))
    expect(hashWorld(generateWorld(1, balance))).not.toBe(hashWorld(generateWorld(2, balance)))
    expect(hashWorld(a)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('AC-2: has valid parcels in row-major order, water borders and plain JSON', () => {
    const w = generateWorld(42, balance)
    const min = balance.soil.classMinQuality
    expect(w.seed).toBe(42)
    expect(w.size).toBe(size)
    expect(w.parcels).toHaveLength(size * size)
    w.parcels.forEach((p, i) => {
      expect([p.x, p.y]).toEqual([i % size, Math.floor(i / size)])
      expect(p.height).toBeGreaterThanOrEqual(0)
      expect(p.height).toBeLessThanOrEqual(1)
      expect(p.fertility).toBeGreaterThanOrEqual(0)
      expect(p.fertility).toBeLessThanOrEqual(100)
      expect(p.waterRetention).toBeGreaterThanOrEqual(0)
      expect(p.waterRetention).toBeLessThanOrEqual(100)
      expect(p.soilQuality).toBeGreaterThanOrEqual(0)
      expect(p.soilQuality).toBeLessThanOrEqual(1)
      const q = p.soilQuality
      const expected =
        q >= min.sehrGut ? 'sehrGut' : q >= min.gut ? 'gut' : q >= min.mittel ? 'mittel' : 'karg'
      expect(p.soilClass).toBe(expected)
      if (p.x === 0 || p.y === 0 || p.x === size - 1 || p.y === size - 1) {
        expect(p.zone).toBe('wasser')
      }
    })
    expect(JSON.parse(JSON.stringify(w))).toEqual(w)
  })

  it('AC-1 (#17): has no volcano zone in 200 worlds', () => {
    const zones = new Set(worlds.flatMap((w) => w.parcels.map((p) => p.zone)))
    expect([...zones].sort()).toEqual(['hochland', 'hochlandKuehl', 'tiefland', 'wasser'])
  })

  it('AC-4: keeps the start guarantee in 200 worlds', () => {
    for (const w of worlds) {
      const start = at(w, w.start.x, w.start.y)!
      expect(start.zone).toBe('tiefland')
      const good = (p: Parcel) =>
        p.zone === 'tiefland' &&
        (p.soilClass === 'gut' || p.soilClass === 'sehrGut') &&
        Math.max(Math.abs(p.x - start.x), Math.abs(p.y - start.y)) <= startReach
      const best = Math.max(0, ...w.parcels.filter(good).map((p) => group(w, p, good).length))
      expect(best).toBeGreaterThanOrEqual(startGuaranteeParcels)
    }
  })

  it('throws a clear error when no attempt gives a valid world', () => {
    const strict = structuredClone(balance)
    strict.world.startGuaranteeParcels = size * size
    strict.world.maxAttempts = 3
    expect(() => generateWorld(5, strict)).toThrow(/seed 5 .*3 attempts/)
  })
})
