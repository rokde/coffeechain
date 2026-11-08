import { describe, expect, it } from 'vitest'
import { createState } from '../state'
import { inspectParcel } from './inspect'
import type { Zone } from './types'

const state = createState(42)
const { world } = state

describe('inspectParcel', () => {
  it.each<[Zone, string | null]>([
    ['tiefland', 'robusta'],
    ['hochland', 'arabicaStandard'],
    ['hochlandKuehl', 'arabicaPremium'],
    ['wasser', null],
  ])('AC-2: %s gives the variety %s', (zone, variety) => {
    const parcel = world.parcels.find((p) => p.zone === zone)!
    expect(parcel).toBeDefined()
    expect(inspectParcel(state, parcel.x, parcel.y)).toMatchObject({
      zone,
      soilClass: parcel.soilClass,
      variety,
      height: parcel.height,
    })
  })

  it('reports water, buildings, trees and buildable land with a reason', () => {
    const { hut, market, trees } = state.props
    expect(inspectParcel(state, hut.x, hut.y)).toMatchObject({ occupant: 'hut', state: 'occupied' })
    expect(inspectParcel(state, market.x, market.y).occupant).toBe('market')
    const tree = trees[0]
    if (tree) expect(inspectParcel(state, tree.x, tree.y).occupant).toBe('tree')
    const water = world.parcels.find((p) => p.zone === 'wasser')!
    expect(inspectParcel(state, water.x, water.y).state).toBe('water')
    const states = new Set(world.parcels.map((p) => inspectParcel(state, p.x, p.y).state))
    expect(states.has('buildable')).toBe(true)
  })
})
