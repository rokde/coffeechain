import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import type { World } from '../sim/world/types'
import { cornerY, HEIGHT_SCALE, parcelCenter } from './surface'

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
