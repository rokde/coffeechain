import { describe, expect, it } from 'vitest'
import raw from '../../../config/balance.json'
import { loadBalance } from '../../../config/balance.schema'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { roundCost } from '../money'
import { createState, type GameState } from '../state'
import type { Parcel, World, Zone } from '../world/types'
import { quoteParcels } from './parcels'
import { parcelPrice } from './price'

const size = 5
const cfg = balance().parcels

// Flat lowland with soilQuality 0.5. (0,0) is water. Each entry of soil sets one parcel.
function world(soil: Record<string, number> = {}, zone: Zone = 'tiefland'): World {
  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const z: Zone = x === 0 && y === 0 ? 'wasser' : zone
      const soilQuality = soil[`${x},${y}`] ?? 0.5
      parcels.push({
        x,
        y,
        height: 0.2,
        zone: z,
        fertility: 50,
        waterRetention: 50,
        soilQuality,
        soilClass: 'gut',
      })
    }
  }
  return { seed: 0, size, parcels, start: { x: 2, y: 2 } }
}

// Sets (x, y) to own and its 4 neighbours to around.
const cross = (x: number, y: number, own: number, around: number) => ({
  [`${x},${y}`]: own,
  [`${x + 1},${y}`]: around,
  [`${x - 1},${y}`]: around,
  [`${x},${y + 1}`]: around,
  [`${x},${y - 1}`]: around,
})

const fromQ = (q: number, zone: Exclude<Zone, 'wasser'> = 'tiefland') =>
  Math.round(
    cfg.baseCost *
      cfg.zoneMultiplier[zone] *
      (cfg.qualityFactor[0] + q * (cfg.qualityFactor[1] - cfg.qualityFactor[0])) *
      100,
  )

describe('parcelPrice (S21d)', () => {
  it('AC-1: gives the same value on each call', () => {
    const w = world(cross(2, 2, 0.4, 0.7))
    expect(parcelPrice(w, 2, 2)).toBe(parcelPrice(w, 2, 2))
  })

  it('AC-1: agrees with the formula on a test world', () => {
    const w = world({ '2,2': 0.4, '3,2': 0.6, '1,2': 0.5, '2,3': 0.7, '2,1': 0.4 }, 'hochland')
    const avg = (0.6 + 0.5 + 0.7 + 0.4) / 4
    const q =
      (1 - cfg.neighborWeight) * 0.4 + cfg.neighborWeight * Math.min(avg, 0.4 + cfg.worseGap)
    expect(parcelPrice(w, 2, 2)).toBe(fromQ(q, 'hochland'))
  })

  it('AC-1: skips water neighbours and parcels outside the map', () => {
    // (1,0) has the water (0,0) and the map edge as neighbours. Its land neighbours are (2,0) and (1,1).
    const w = world({ '1,0': 0.5, '2,0': 0.55, '1,1': 0.55 })
    const q = (1 - cfg.neighborWeight) * 0.5 + cfg.neighborWeight * 0.55
    expect(parcelPrice(w, 1, 0)).toBe(fromQ(q))
  })

  it('AC-1: uses own as avg when no neighbour is land', () => {
    // The neighbours of (1,0) are the water (0,0), the map edge, and (2,0) and (1,1), now also water.
    const w = world({ '1,0': 0.8 })
    for (const i of [2, size + 1]) w.parcels[i]!.zone = 'wasser'
    expect(parcelPrice(w, 1, 0)).toBe(fromQ(0.8))
  })

  it('AC-1: a higher soilQuality gives a higher price when the neighbours are equal', () => {
    const prices = [0.2, 0.4, 0.6, 0.8].map((own) =>
      parcelPrice(world(cross(2, 2, own, 0.5)), 2, 2),
    )
    for (let i = 1; i < prices.length; i++) expect(prices[i]).toBeGreaterThan(prices[i - 1]!)
  })

  it('AC-2: neighbours make the prices of similar parcels closer', () => {
    const a = parcelPrice(world(cross(2, 2, 0.6, 0.6)), 2, 2)
    const b = parcelPrice(world(cross(2, 2, 0.5, 0.7)), 2, 2)
    const without = fromQ(0.6) - fromQ(0.5)
    expect(Math.abs(a - b)).toBeLessThan(without)
  })

  it('AC-2: a clearly worse parcel stays cheap', () => {
    const price = parcelPrice(world(cross(2, 2, 0.2, 0.8)), 2, 2)
    expect(price).toBeLessThanOrEqual(fromQ(0.2 + cfg.neighborWeight * cfg.worseGap))
  })
})

describe('quoteParcels with parcelPrice (S21d)', () => {
  const state = (): GameState => ({
    ...createState(1),
    world: world({ ...cross(2, 2, 0.9, 0.3), '1,3': 0.1 }),
    props: { hut: { x: 4, y: 4 }, market: { x: 4, y: 4 }, path: [], trees: [] },
    money: 50000,
  })
  const list = [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 1, y: 3 },
  ]

  it('AC-3: charges firstCost for the first parcel and parcelPrice for the others', () => {
    const s = state()
    // S57: the total of the command rounds up to whole CC.
    const expected = roundCost(
      Math.round(cfg.firstCost * cfg.zoneMultiplier.tiefland * 100) +
        parcelPrice(s.world, 3, 2) +
        parcelPrice(s.world, 1, 3),
    )
    expect(quoteParcels(s, list)).toBe(expected)
    const after = dispatch(s, { type: 'CreateParcels', parcels: list })
    expect(s.money - after.money).toBe(expected)
  })

  it('AC-3: charges parcelPrice for the first listed parcel when the farm owns one', () => {
    const s = dispatch(state(), { type: 'CreateParcels', parcels: [{ x: 1, y: 1 }] })
    expect(quoteParcels(s, [list[0]!])).toBe(roundCost(parcelPrice(s.world, 2, 2)))
  })
})

describe('balance config (S21d)', () => {
  it('AC-4: has the new parcel prices from Robert, and the schema loads them', () => {
    for (const key of [
      'firstCost',
      'baseCost',
      'neighborWeight',
      'worseGap',
      'qualityFactor',
    ] as const) {
      expect(raw.parcels[key].src, key).toMatch(/^Robert 2026-10-20/)
      expect(loadBalance(raw).parcels[key], key).toEqual(raw.parcels[key].v)
    }
    expect(raw.parcels.zoneMultiplier.v).toEqual({
      tiefland: 1,
      hochland: 1.5,
      hochlandKuehl: 2,
      vulkan: 4,
    })
    expect(raw.parcels.maxSlope.v).toBe(0.15)
  })
})
