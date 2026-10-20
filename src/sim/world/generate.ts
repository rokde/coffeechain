import { createNoise2D } from 'simplex-noise'
import type { Balance } from '../../../config/balance.schema'
import { mulberry32 } from '../rng'
import type { Parcel, SoilClass, World, Zone } from './types'

const chebyshev = (a: Parcel, b: Parcel) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

export function generateWorld(seed: number, balance: Balance): World {
  const { maxAttempts } = balance.world
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const world = tryGenerate((seed + Math.imul(attempt, 0x9e3779b9)) >>> 0, balance)
    if (world) return { ...world, seed }
  }
  throw new Error(
    `World generation failed: seed ${seed} gave no valid world in ${maxAttempts} attempts`,
  )
}

export function soilClassOf(quality: number, min: Balance['soil']['classMinQuality']): SoilClass {
  if (quality >= min.sehrGut) return 'sehrGut'
  if (quality >= min.gut) return 'gut'
  if (quality >= min.mittel) return 'mittel'
  return 'karg'
}

function tryGenerate(seed: number, balance: Balance): World | undefined {
  const { size, zoneMinHeight, falloffPower, noiseScale } = balance.world
  const random = mulberry32(seed)
  const heightNoise = createNoise2D(random)
  const fertilityNoise = createNoise2D(random)
  const waterNoise = createNoise2D(random)
  const unit = (n: number) => (n + 1) / 2
  const center = (size - 1) / 2

  const parcels: Parcel[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x - center) / center, (y - center) / center)
      const falloff = Math.max(0, 1 - d ** falloffPower)
      const height = unit(heightNoise(x * noiseScale.height, y * noiseScale.height)) * falloff
      const border = x === 0 || y === 0 || x === size - 1 || y === size - 1
      const zone: Zone =
        border || height < zoneMinHeight.tiefland
          ? 'wasser'
          : height < zoneMinHeight.hochland
            ? 'tiefland'
            : height < zoneMinHeight.hochlandKuehl
              ? 'hochland'
              : 'hochlandKuehl'
      const fertility = Math.round(
        100 * unit(fertilityNoise(x * noiseScale.fertility, y * noiseScale.fertility)),
      )
      const waterRetention = Math.round(
        100 * unit(waterNoise(x * noiseScale.waterRetention, y * noiseScale.waterRetention)),
      )
      const soilQuality = (fertility + waterRetention) / 200
      const soilClass = soilClassOf(soilQuality, balance.soil.classMinQuality)
      parcels.push({ x, y, height, zone, fertility, waterRetention, soilQuality, soilClass })
    }
  }

  const neighbours = (p: Parcel) =>
    [
      [p.x + 1, p.y],
      [p.x - 1, p.y],
      [p.x, p.y + 1],
      [p.x, p.y - 1],
    ]
      .filter(([x, y]) => x! >= 0 && y! >= 0 && x! < size && y! < size)
      .map(([x, y]) => parcels[y! * size + x!]!)

  // Flood fill from `from` over parcels that pass `ok`. Stops at `limit` parcels.
  const flood = (from: Parcel, ok: (p: Parcel) => boolean, limit: number) => {
    const group = [from]
    const seen = new Set(group)
    for (let i = 0; i < group.length && group.length < limit; i++) {
      for (const n of neighbours(group[i]!)) {
        if (seen.has(n) || !ok(n)) continue
        seen.add(n)
        group.push(n)
        if (group.length === limit) break
      }
    }
    return group
  }

  const { startReach, startGuaranteeParcels, volcanoSize } = balance.world
  const goodLowland = (p: Parcel) =>
    p.zone === 'tiefland' && (p.soilClass === 'gut' || p.soilClass === 'sehrGut')
  const starts = parcels.filter(
    (s) =>
      goodLowland(s) &&
      flood(s, (p) => goodLowland(p) && chebyshev(p, s) <= startReach, startGuaranteeParcels)
        .length >= startGuaranteeParcels,
  )
  if (starts.length === 0) return undefined
  const start = starts[Math.floor(random() * starts.length)]!

  // The volcano grows from the land parcel farthest from the start and stays out of the start reach.
  const volcanoOk = (p: Parcel) => p.zone !== 'wasser' && chebyshev(p, start) > startReach
  const dist2 = (p: Parcel) => (p.x - start.x) ** 2 + (p.y - start.y) ** 2
  const core = parcels
    .filter(volcanoOk)
    .reduce<Parcel | undefined>(
      (best, p) => (!best || dist2(p) > dist2(best) ? p : best),
      undefined,
    )
  if (!core) return undefined
  const volcano = flood(core, volcanoOk, volcanoSize)
  if (volcano.length < volcanoSize) return undefined
  for (const p of volcano) p.zone = 'vulkan'

  return { seed, size, parcels, start: { x: start.x, y: start.y } }
}
