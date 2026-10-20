import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { dispatch } from '../sim/commands'
import { balance } from '../sim/balance'
import { isBuildable, isFree } from '../sim/farm/parcels'
import { createState } from '../sim/state'
import { canSelect, markParcel, parcelRect, pickTool, useSelectionStore } from './selection'

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

describe('selection first (S40c)', () => {
  beforeEach(() => setActivePinia(createPinia()))
  const key = (p: { x: number; y: number }) => `${p.x},${p.y}`

  it('AC-1: parcelRect gives the 9 parcels of the grid rectangle for each corner order', () => {
    const want = [1, 2, 3].flatMap((y) => [2, 3, 4].map((x) => `${x},${y}`)).sort()
    for (const [a, b] of [
      [
        { x: 2, y: 3 },
        { x: 4, y: 1 },
      ],
      [
        { x: 4, y: 1 },
        { x: 2, y: 3 },
      ],
      [
        { x: 2, y: 1 },
        { x: 4, y: 3 },
      ],
      [
        { x: 4, y: 3 },
        { x: 2, y: 1 },
      ],
    ])
      expect(parcelRect(a!, b!).map(key).sort()).toEqual(want)
  })

  it('AC-1: markParcel replaces on a click, and adds or removes on a Shift-click', () => {
    const a = { x: 1, y: 1 }
    const b = { x: 2, y: 1 }
    expect(markParcel([a], b, false)).toEqual([b])
    expect(markParcel([a], b, true)).toEqual([a, b])
    expect(markParcel([a, b], { x: 2, y: 1 }, true)).toEqual([a])
  })

  const [free, empty, young] = world.parcels
    .filter((p) => p.zone === 'tiefland' && isFree(state, p.x, p.y))
    .map(at)
  const owned = dispatch(
    { ...state, money: 100000 },
    { type: 'CreateParcels', parcels: [empty!, young!] },
  )
  const planted = dispatch(owned, { type: 'Plant', variety: 'robusta', parcels: [young!] })
  const marks = [free!, empty!, young!]

  it('AC-2: plant keeps only the owned empty parcel, fertilize only the planted parcel', () => {
    const selection = useSelectionStore()
    selection.parcels = marks
    pickTool(selection, planted, 'plant')
    expect(selection.tool).toBe('plant')
    expect(selection.parcels).toEqual([empty])
    selection.parcels = marks
    pickTool(selection, planted, 'fertilize')
    expect(selection.parcels).toEqual([young])
  })

  it('AC-2: a change from one brush tool to another filters the marks again', () => {
    const selection = useSelectionStore()
    selection.parcels = marks
    pickTool(selection, planted, 'parcel')
    expect(selection.parcels).toEqual([free])
    pickTool(selection, planted, 'plant')
    expect(selection.parcels).toEqual([])
  })

  it('Round 1: a brush tool that keeps no mark sets the note, a tool with kept marks does not', () => {
    const selection = useSelectionStore()
    selection.parcels = [free!]
    pickTool(selection, planted, 'harvest')
    expect(selection.parcels).toEqual([])
    expect(selection.note).toBe('invalid')
    selection.parcels = marks
    pickTool(selection, planted, 'plant')
    expect(selection.note).toBeNull()
    pickTool(selection, planted, 'fertilize')
    expect(selection.note).toBe('invalid')
    pickTool(selection, planted, 'parcel')
    expect(selection.note).toBeNull()
  })

  it.each(['select', 'market'])('AC-2: %s clears the marks', (id) => {
    const selection = useSelectionStore()
    selection.tool = 'plant'
    selection.parcels = marks
    pickTool(selection, planted, id)
    expect(selection.parcels).toEqual([])
  })

  it.each(['plant', 'select', 'market'])('AC-2: a change to %s clears the note', (id) => {
    const selection = useSelectionStore()
    selection.tool = 'parcel'
    selection.note = 'money'
    pickTool(selection, planted, id)
    expect(selection.note).toBeNull()
  })
})
