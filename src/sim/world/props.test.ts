import { describe, expect, it } from 'vitest'
import raw from '../../../config/balance.json'
import { loadBalance } from '../../../config/balance.schema'
import { mulberry32 } from '../rng'
import { generateWorld } from './generate'
import { placeProps } from './props'
import type { World } from './types'

const balance = loadBalance(raw)
const { startReach } = balance.world

const random = mulberry32(2024)
const seeds = Array.from({ length: 200 }, () => Math.floor(random() * 2 ** 32))
const worlds = seeds.map((s) => generateWorld(s, balance))
const cases = worlds.map((w) => ({ w, props: placeProps(w, balance) }))

const at = (w: World, x: number, y: number) =>
  x >= 0 && x < w.size && y >= 0 && y < w.size ? w.parcels[y * w.size + x] : undefined
const isLand = (w: World, x: number, y: number) => {
  const p = at(w, x, y)
  return p !== undefined && p.zone !== 'wasser'
}
const isShore = (w: World, x: number, y: number) =>
  isLand(w, x, y) &&
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => at(w, x + dx!, y + dy!)?.zone === 'wasser')

describe('placeProps', () => {
  it('AC-1: puts the hut on the start and the market on another shore parcel', () => {
    for (const { w, props } of cases) {
      expect(props.hut).toEqual(w.start)
      expect(isShore(w, props.market.x, props.market.y)).toBe(true)
      expect(props.market).not.toEqual(props.hut)
    }
  })

  it('AC-1: takes the nearest shore parcel over land, and the lowest index on a tie', () => {
    // Water ring around a 3 x 3 land block. Start in the middle: all four edge middles are 1 step away.
    const rows = ['WWWWW', 'WLLLW', 'WLLLW', 'WLLLW', 'WWWWW']
    const w: World = {
      seed: 0,
      size: 5,
      start: { x: 2, y: 2 },
      parcels: rows.flatMap((row, y) =>
        [...row].map((c, x) => ({
          ...worlds[0]!.parcels[0]!,
          x,
          y,
          zone: c === 'W' ? ('wasser' as const) : ('tiefland' as const),
        })),
      ),
    }
    const props = placeProps(w, balance)
    expect(props.market).toEqual({ x: 2, y: 1 })
    expect(props.path).toEqual([
      { x: 2, y: 2 },
      { x: 2, y: 1 },
    ])
  })

  it('AC-2: gives a 4-connected land path from the hut to the market without repeats', () => {
    for (const { w, props } of cases) {
      const { path } = props
      expect(path[0]).toEqual(props.hut)
      expect(path.at(-1)).toEqual(props.market)
      for (const p of path) expect(isLand(w, p.x, p.y)).toBe(true)
      for (let i = 1; i < path.length; i++) {
        expect(Math.abs(path[i]!.x - path[i - 1]!.x) + Math.abs(path[i]!.y - path[i - 1]!.y)).toBe(
          1,
        )
      }
      expect(new Set(path.map((p) => p.y * w.size + p.x)).size).toBe(path.length)
    }
  })

  it('AC-3: puts a tree on exactly the poor land parcels outside the start area and off the path', () => {
    for (const { w, props } of cases) {
      const onPath = new Set(props.path.map((p) => p.y * w.size + p.x))
      const expected = w.parcels
        .filter(
          (p) =>
            p.zone !== 'wasser' &&
            p.soilClass === 'karg' &&
            Math.max(Math.abs(p.x - w.start.x), Math.abs(p.y - w.start.y)) > startReach &&
            !onPath.has(p.y * w.size + p.x),
        )
        .map((p) => ({ x: p.x, y: p.y }))
      expect(props.trees).toEqual(expected)
    }
  })

  it('AC-3: has trees on at least some worlds', () => {
    expect(cases.some(({ props }) => props.trees.length > 0)).toBe(true)
  })

  it('AC-4: is deterministic and survives JSON', () => {
    for (const { w, props } of cases.slice(0, 20)) {
      expect(placeProps(w, balance)).toEqual(props)
      expect(JSON.parse(JSON.stringify(props))).toEqual(props)
    }
  })
})
