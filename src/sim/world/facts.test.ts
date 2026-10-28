import { describe, expect, it } from 'vitest'
import { createState } from '../state'
import { islandFacts } from './facts'
import type { Parcel, World, Zone } from './types'

function makeWorld(zones: Zone[]): World {
  const parcels: Parcel[] = zones.map((zone, i) => ({
    x: i,
    y: 0,
    height: 0,
    zone,
    fertility: 0,
    waterRetention: 0,
    soilQuality: 0,
    soilClass: i === 0 ? 'gut' : 'karg',
  }))
  return { seed: 1, size: zones.length, parcels, start: { x: 0, y: 0 } }
}

describe('islandFacts (#3)', () => {
  it('AC-1: shares count land parcels only', () => {
    const zones: Zone[] = [
      ...Array<Zone>(6).fill('tiefland'),
      ...Array<Zone>(3).fill('hochland'),
      'hochlandKuehl',
      ...Array<Zone>(5).fill('wasser'),
    ]
    expect(islandFacts(makeWorld(zones)).shares).toEqual({
      tiefland: 60,
      hochland: 30,
      hochlandKuehl: 10,
    })
  })

  it('AC-2: the hut is the start parcel, and the result is stable', () => {
    const { world } = createState(48213)
    const facts = islandFacts(world)
    const p = world.parcels[world.start.y * world.size + world.start.x]!
    expect(facts.hut).toEqual({ x: p.x, y: p.y, zone: p.zone, soilClass: p.soilClass })
    expect(islandFacts(createState(48213).world)).toEqual(facts)
  })
})
