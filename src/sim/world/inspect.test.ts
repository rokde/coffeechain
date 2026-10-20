import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { isBuildable } from '../farm/parcels'
import { generateWorld } from './generate'
import { inspectParcel } from './inspect'
import type { Zone } from './types'

const world = generateWorld(42, balance())

describe('inspectParcel', () => {
  it.each<[Zone, string | null]>([
    ['tiefland', 'robusta'],
    ['hochland', 'arabicaStandard'],
    ['hochlandKuehl', 'arabicaPremium'],
    ['vulkan', 'specialty'],
    ['wasser', null],
  ])('AC-2: %s gives the variety %s', (zone, variety) => {
    const parcel = world.parcels.find((p) => p.zone === zone)!
    expect(parcel).toBeDefined()
    expect(inspectParcel(world, parcel.x, parcel.y)).toEqual({
      zone,
      soilClass: parcel.soilClass,
      variety,
      buildable: isBuildable(world, parcel.x, parcel.y),
    })
  })
})
