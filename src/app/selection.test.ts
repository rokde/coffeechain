import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { dispatch } from '../sim/commands'
import { isBuildable } from '../sim/farm/parcels'
import { createState } from '../sim/state'
import { useSelectionStore } from './selection'

const state = createState(42)
const { world } = state
const find = (test: (p: (typeof world.parcels)[number]) => boolean) => world.parcels.find(test)!
const land = find((p) => p.zone === 'tiefland' && isBuildable(world, p.x, p.y))
const water = find((p) => p.zone === 'wasser')
const steep = find((p) => p.zone !== 'wasser' && !isBuildable(world, p.x, p.y))
const at = (p: { x: number; y: number }) => ({ x: p.x, y: p.y })

describe('selection store (S12)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('AC-2: starts with the select tool and no parcels', () => {
    const selection = useSelectionStore()
    expect(selection.tool).toBe('select')
    expect(selection.parcels).toEqual([])
  })

  it('AC-2: a second toggle of the same parcel removes it', () => {
    const selection = useSelectionStore()
    selection.toggle(state, at(land))
    expect(selection.parcels).toEqual([at(land)])
    selection.toggle(state, at(land))
    expect(selection.parcels).toEqual([])
  })

  it('AC-2: a change of tool clears the parcels', () => {
    const selection = useSelectionStore()
    selection.tool = 'parcel'
    selection.toggle(state, at(land))
    selection.tool = 'select'
    expect(selection.parcels).toEqual([])
  })

  it('AC-2: does not add a water, too steep or owned parcel', () => {
    const selection = useSelectionStore()
    const owned = dispatch(state, { type: 'CreateParcels', parcels: [at(land)] })
    selection.toggle(state, at(water))
    selection.toggle(state, at(steep))
    selection.toggle(owned, at(land))
    expect(selection.parcels).toEqual([])
  })
})
