import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { dispatch } from '../sim/commands'
import { balance } from '../sim/balance'
import { isBuildable, isFree } from '../sim/farm/parcels'
import { createState } from '../sim/state'
import { canSelect, useSelectionStore } from './selection'

const state = createState(42)
const { world } = state
const find = (test: (p: (typeof world.parcels)[number]) => boolean) => world.parcels.find(test)!
const land = find((p) => p.zone === 'tiefland' && isFree(state, p.x, p.y))
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

describe('canSelect, parcel tool (S21b)', () => {
  const { hut, market, path } = state.props
  it.each([hut, market, ...path].map(at))('AC-4: is false for the prop parcel %o', (p) => {
    expect(canSelect(state, 'parcel', p)).toBe(false)
  })

  it('AC-4: is true for a free, buildable parcel that the farm does not own', () => {
    expect(isBuildable(world, land.x, land.y)).toBe(true)
    expect(canSelect(state, 'parcel', at(land))).toBe(true)
  })
})

describe('selection store, plant tool (S13)', () => {
  beforeEach(() => setActivePinia(createPinia()))
  const other = find((p) => p.zone === 'tiefland' && isFree(state, p.x, p.y) && p !== land)
  const owned = dispatch(state, { type: 'CreateParcels', parcels: [at(land), at(other)] })
  const planted = dispatch(owned, { type: 'Plant', variety: 'robusta', parcels: [at(other)] })

  it('AC-2: adds an owned parcel without a plant, and a second toggle removes it', () => {
    const selection = useSelectionStore()
    selection.tool = 'plant'
    selection.toggle(planted, at(land))
    expect(selection.parcels).toEqual([at(land)])
    selection.toggle(planted, at(land))
    expect(selection.parcels).toEqual([])
  })

  it('AC-2: does not add an unowned parcel or a parcel with a plant', () => {
    const selection = useSelectionStore()
    selection.tool = 'plant'
    selection.toggle(state, at(land))
    selection.toggle(planted, at(other))
    expect(selection.parcels).toEqual([])
  })
})

describe('selection store, farm tools (S18a)', () => {
  beforeEach(() => setActivePinia(createPinia()))
  const lands = world.parcels.filter((p) => p.zone === 'tiefland' && isFree(state, p.x, p.y))
  const [empty, young, done, fresh] = lands.map(at)
  const owned = dispatch(
    { ...state, money: 100000 },
    {
      type: 'CreateParcels',
      parcels: [empty!, young!, done!],
    },
  )
  const planted = dispatch(owned, { type: 'Plant', variety: 'robusta', parcels: [young!, done!] })
  const { cycleDays } = balance().varieties.robusta
  const ripeHour = planted.time.hour + cycleDays * balance().time.ticksPerGameDay
  // In mixed, the plant on done is ripe. The plant on young is planted later and is not ripe.
  const later = { ...planted, time: { ...planted.time, hour: ripeHour - 1 } }
  const mixed = {
    ...later,
    time: { ...later.time, hour: ripeHour },
    farm: {
      ...later.farm,
      plants: {
        ...later.farm.plants,
        [young!.y * world.size + young!.x]: { variety: 'robusta' as const, plantedHour: 1 },
      },
    },
  }

  it.each([
    ['fertilize', 'Fertilize'],
    ['irrigate', 'Irrigate'],
    ['protect', 'ProtectPests'],
  ] as const)(
    'AC-2: %s adds only owned parcels with an unripe plant without this care',
    (tool, type) => {
      const selection = useSelectionStore()
      selection.tool = tool
      selection.toggle(mixed, empty!)
      selection.toggle(mixed, done!)
      selection.toggle(mixed, fresh!)
      expect(selection.parcels).toEqual([])
      selection.toggle(mixed, young!)
      expect(selection.parcels).toEqual([young])
      selection.parcels = []
      const cared = dispatch(mixed, { type, parcels: [young!] })
      selection.toggle(cared, young!)
      expect(selection.parcels).toEqual([])
    },
  )

  it('AC-4: harvest adds only owned parcels with a ripe plant', () => {
    const selection = useSelectionStore()
    selection.tool = 'harvest'
    for (const p of [empty!, young!, fresh!]) selection.toggle(mixed, p)
    selection.toggle(later, done!)
    expect(selection.parcels).toEqual([])
    selection.toggle(mixed, done!)
    expect(selection.parcels).toEqual([done])
  })
})
