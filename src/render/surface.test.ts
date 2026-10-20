import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import type { World } from '../sim/world/types'
import { generateWorld } from '../sim/world/generate'
import { cornerY, HEIGHT_SCALE, parcelCenter, terrainHeightAt } from './surface'

const sea = balance().world.zoneMinHeight.tiefland
// Heights row-major: (0,0) = 0.2, (1,0) = 0.4, (0,1) = 0.6, (1,1) = 1.0.
const heights = [0.2, 0.4, 0.6, 1.0]
const world: World = {
  seed: 0,
  size: 2,
  start: { x: 0, y: 0 },
  parcels: heights.map((height, i) => ({
    x: i % 2,
    y: Math.floor(i / 2),
    height,
    zone: 'tiefland',
    fertility: 50,
    waterRetention: 50,
    soilQuality: 0.5,
    soilClass: 'mittel',
  })),
}
const y = (mean: number) => (mean - sea) * HEIGHT_SCALE

describe('surface', () => {
  it('AC-1: gives corners from the mean height of the touching parcels', () => {
    expect(HEIGHT_SCALE).toBe(6)
    expect(cornerY(world, 0, 0)).toBeCloseTo(y(0.2))
    expect(cornerY(world, 1, 0)).toBeCloseTo(y(0.3))
    expect(cornerY(world, 0, 1)).toBeCloseTo(y(0.4))
    expect(cornerY(world, 1, 1)).toBeCloseTo(y(0.55))
    expect(cornerY(world, 2, 2)).toBeCloseTo(y(1.0))
    expect(cornerY(world, 2, 1)).toBeCloseTo(y(0.7))
  })

  it('AC-1: puts the parcel center on the (x, y)–(x + 1, y + 1) diagonal', () => {
    const c00 = parcelCenter(world, 0, 0)
    expect(c00.x).toBeCloseTo(-0.5)
    expect(c00.z).toBeCloseTo(-0.5)
    expect(c00.y).toBeCloseTo((y(0.2) + y(0.55)) / 2)
    const c10 = parcelCenter(world, 1, 0)
    expect(c10.x).toBeCloseTo(0.5)
    expect(c10.z).toBeCloseTo(-0.5)
    expect(c10.y).toBeCloseTo((y(0.3) + y(0.7)) / 2)
    const c11 = parcelCenter(world, 1, 1)
    expect(c11.x).toBeCloseTo(0.5)
    expect(c11.z).toBeCloseTo(0.5)
    expect(c11.y).toBeCloseTo((y(0.55) + y(1.0)) / 2)
  })
})

describe('terrainHeightAt (S40b)', () => {
  const big = generateWorld(48213, balance())
  const n = big.size

  it('AC-2: is equal to cornerY at each grid corner and to the parcel center height', () => {
    for (let cz = 0; cz <= n; cz++) {
      for (let cx = 0; cx <= n; cx++) {
        expect(terrainHeightAt(big, cx - n / 2, cz - n / 2)).toBeCloseTo(cornerY(big, cx, cz), 9)
      }
    }
    for (const p of big.parcels) {
      const c = parcelCenter(big, p.x, p.y)
      expect(terrainHeightAt(big, c.x, c.z)).toBeCloseTo(c.y, 9)
    }
  })

  it('AC-2: blends the three triangle corners linearly inside a triangle', () => {
    // Small world: parcel (0, 0) spans x and z in [-1, 0].
    const [h00, h10, h01, h11] = [
      cornerY(world, 0, 0),
      cornerY(world, 1, 0),
      cornerY(world, 0, 1),
      cornerY(world, 1, 1),
    ]
    // Lower triangle (0,0), (1,0), (1,1): fx > fz.
    expect(terrainHeightAt(world, -1 + 0.7, -1 + 0.2)).toBeCloseTo(
      0.3 * h00 + 0.5 * h10 + 0.2 * h11,
      9,
    )
    // Upper triangle (0,0), (0,1), (1,1): fz > fx.
    expect(terrainHeightAt(world, -1 + 0.1, -1 + 0.6)).toBeCloseTo(
      0.4 * h00 + 0.5 * h01 + 0.1 * h11,
      9,
    )
  })
})
