import { Color, Mesh, type BufferAttribute } from 'three'
import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { generateWorld } from '../sim/world/generate'
import type { SoilClass } from '../sim/world/types'
import { applyOverlay, overlayColors, SOIL_COLORS, ZONE_OVERLAY_COLORS } from './overlays'
import { buildTerrainGeometry, createTerrain, ZONE_COLORS } from './terrain'

const world = generateWorld(42, balance())

function expectParcelColors(colors: Float32Array, hexOf: (i: number) => number) {
  world.parcels.forEach((_, i) => {
    const c = new Color(hexOf(i))
    for (let v = 4 * i; v < 4 * i + 4; v++) {
      expect([...colors.subarray(v * 3, v * 3 + 3)]).toEqual([c.r, c.g, c.b].map(Math.fround))
    }
  })
}

describe('overlayColors', () => {
  it('gives the S5 terrain colors for none', () => {
    const attribute = buildTerrainGeometry(world).getAttribute('color')
    expect(overlayColors(world, 'none')).toEqual(attribute.array)
  })

  it('gives land parcels the soil class color and water the water color for soil', () => {
    const colors = overlayColors(world, 'soil')
    expectParcelColors(colors, (i) => {
      const p = world.parcels[i]!
      return p.zone === 'wasser' ? ZONE_COLORS.wasser : SOIL_COLORS[p.soilClass]
    })
    expect(world.parcels.some((p) => p.zone === 'wasser')).toBe(true)
    const order: SoilClass[] = ['karg', 'mittel', 'gut', 'sehrGut']
    const lightness = order.map((s) => new Color(SOIL_COLORS[s]).getHSL({ h: 0, s: 0, l: 0 }).l)
    for (let i = 1; i < lightness.length; i++) expect(lightness[i]).toBeLessThan(lightness[i - 1]!)
  })

  it('gives each zone its own strong color for zone', () => {
    expectParcelColors(
      overlayColors(world, 'zone'),
      (i) => ZONE_OVERLAY_COLORS[world.parcels[i]!.zone],
    )
    const values = Object.values(ZONE_OVERLAY_COLORS)
    expect(new Set(values).size).toBe(5)
    for (const v of values) expect(Object.values(ZONE_COLORS)).not.toContain(v)
  })
})

describe('applyOverlay', () => {
  it('changes the mesh colors in place', () => {
    const mesh: Mesh = createTerrain(world)
    const geometry = mesh.geometry
    const attribute = geometry.getAttribute('color') as BufferAttribute
    for (const mode of ['soil', 'zone', 'none'] as const) {
      const version = attribute.version
      applyOverlay(mesh, world, mode)
      expect(mesh.geometry).toBe(geometry)
      expect(geometry.getAttribute('color')).toBe(attribute)
      expect(attribute.array).toEqual(overlayColors(world, mode))
      expect(attribute.version).toBe(version + 1)
    }
  })
})
