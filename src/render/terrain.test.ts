import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { generateWorld } from '../sim/world/generate'
import { buildTerrainGeometry, ZONE_COLORS } from './terrain'

const world = generateWorld(42, balance())
const n = world.size
const geometry = buildTerrainGeometry(world)
const position = geometry.getAttribute('position')
const color = geometry.getAttribute('color')

describe('buildTerrainGeometry', () => {
  it('has 4 vertices and 6 indices per parcel', () => {
    expect(position.count).toBe(4 * n * n)
    expect(color.count).toBe(4 * n * n)
    expect(geometry.getIndex()!.count).toBe(6 * n * n)
  })

  it('colors all 4 vertices of a parcel with its zone color', () => {
    world.parcels.forEach((p, i) => {
      const expected = new Color(ZONE_COLORS[p.zone])
      for (let v = 4 * i; v < 4 * i + 4; v++) {
        expect([color.getX(v), color.getY(v), color.getZ(v)]).toEqual(
          [expected.r, expected.g, expected.b].map(Math.fround),
        )
      }
    })
    expect(new Set(Object.values(ZONE_COLORS)).size).toBe(5)
  })

  it('has no gaps and puts water-only corners below y = 0', () => {
    const corners = new Map<string, { y: Set<number>; zones: Set<string> }>()
    world.parcels.forEach((p, i) => {
      for (let v = 4 * i; v < 4 * i + 4; v++) {
        const key = `${position.getX(v)},${position.getZ(v)}`
        const corner = corners.get(key) ?? { y: new Set(), zones: new Set() }
        corner.y.add(position.getY(v))
        corner.zones.add(p.zone)
        corners.set(key, corner)
      }
    })
    expect(corners.size).toBe((n + 1) ** 2)
    let waterOnly = 0
    for (const { y, zones } of corners.values()) {
      expect(y.size).toBe(1)
      if (zones.size === 1 && zones.has('wasser')) {
        waterOnly++
        expect([...y][0]).toBeLessThan(0)
      }
    }
    expect(waterOnly).toBeGreaterThan(0)
  })

  it('centers parcel (x, y) at x − (n − 1) / 2, z = y − (n − 1) / 2', () => {
    world.parcels.forEach((p, i) => {
      let x = 0
      let z = 0
      for (let v = 4 * i; v < 4 * i + 4; v++) {
        x += position.getX(v) / 4
        z += position.getZ(v) / 4
      }
      expect(x).toBeCloseTo(p.x - (n - 1) / 2)
      expect(z).toBeCloseTo(p.y - (n - 1) / 2)
    })
  })
})
