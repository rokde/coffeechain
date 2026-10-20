import { Color, type Mesh } from 'three'
import type { SoilClass, World, Zone } from '../sim/world/types'
import { ZONE_COLORS } from './terrain'

export type OverlayMode = 'none' | 'soil' | 'zone'

// From the mockup legend: light = poor, dark = very good.
export const SOIL_COLORS: Record<SoilClass, number> = {
  karg: 0xf0e3c0,
  mittel: 0xd4a86a,
  gut: 0x9c6634,
  sehrGut: 0x5a3a22,
}

// Strong map colors, clearly apart from the S5 colors.
export const ZONE_OVERLAY_COLORS: Record<Zone, number> = {
  wasser: 0x2f7fd8,
  tiefland: 0xf2d33a,
  hochland: 0x2fa84f,
  hochlandKuehl: 0x8e5bd6,
  vulkan: 0xd8432f,
}

// One RGB triple per vertex, 4 vertices per parcel, in the order of buildTerrainGeometry.
export function overlayColors(world: World, mode: OverlayMode): Float32Array {
  const out = new Float32Array(world.parcels.length * 12)
  const color = new Color()
  world.parcels.forEach((p, i) => {
    color.setHex(
      mode === 'zone'
        ? ZONE_OVERLAY_COLORS[p.zone]
        : mode === 'soil' && p.zone !== 'wasser'
          ? SOIL_COLORS[p.soilClass]
          : ZONE_COLORS[p.zone],
    )
    for (let v = 0; v < 4; v++) out.set([color.r, color.g, color.b], i * 12 + v * 3)
  })
  return out
}

export function applyOverlay(mesh: Mesh, world: World, mode: OverlayMode): void {
  const attribute = mesh.geometry.getAttribute('color')
  ;(attribute.array as Float32Array).set(overlayColors(world, mode))
  attribute.needsUpdate = true
}
