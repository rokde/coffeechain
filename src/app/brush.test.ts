import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { dispatch } from '../sim/commands'
import { isFree, quoteParcels } from '../sim/farm/parcels'
import { quotePlant } from '../sim/farm/plants'
import { createState, type GameState } from '../sim/state'
import { brushParcel, isClick, strokeParcel } from './brush'
import type { BrushTool } from './selection'

const fresh = createState(42)
const [a, b, c] = fresh.world.parcels
  .filter((p) => p.zone === 'tiefland' && isFree(fresh, p.x, p.y))
  .slice(0, 3)
  .map(({ x, y }) => ({ x, y }))
const rich = { ...fresh, money: 100000 }
const owned = dispatch(rich, { type: 'CreateParcels', parcels: [a!] })
const planted = dispatch(owned, { type: 'Plant', variety: 'robusta', parcels: [a!] })
const { cycleDays } = balance().varieties.robusta
const ripe = {
  ...planted,
  time: { ...planted.time, hour: planted.time.hour + cycleDays * balance().time.ticksPerGameDay },
}
const care = balance().varieties.robusta.careCost
const careCost = (key: keyof typeof care) => Math.round(care[key] * 100)

// Tool, the state where the tool can act on parcel a, the command and the one-parcel cost.
const cases: [BrushTool, GameState, object, number][] = [
  ['parcel', rich, { type: 'CreateParcels' }, quoteParcels(rich, [a!])],
  [
    'plant',
    owned,
    { type: 'Plant', variety: 'arabicaStandard' },
    quotePlant(owned, 'arabicaStandard', 1),
  ],
  ['fertilize', planted, { type: 'Fertilize' }, careCost('fertilizer')],
  ['irrigate', planted, { type: 'Irrigate' }, careCost('irrigation')],
  ['harvest', ripe, { type: 'Harvest' }, 0],
]

describe('brushParcel (S40)', () => {
  it.each(cases)('AC-1: %s gives its command with exactly one parcel', (tool, state, command) => {
    const result = brushParcel(state, tool, 'arabicaStandard', a!)
    expect(result).toEqual({ ...command, parcels: [a] })
    expect(() => dispatch(state, result as Exclude<typeof result, string>)).not.toThrow()
  })

  it.each(cases)('AC-1: %s gives "invalid" when canSelect refuses the parcel', (tool, state) => {
    // Parcel b is not owned, so only the parcel tool accepts it. A parcel the farm owns refuses the parcel tool.
    const p = tool === 'parcel' ? a! : b!
    const s = tool === 'parcel' ? owned : state
    expect(brushParcel(s, tool, 'robusta', p)).toBe('invalid')
  })

  it.each(cases.filter(([, , , cost]) => cost > 0))(
    'AC-1: %s gives "money" when the cost is more than the balance',
    (tool, state, _, cost) => {
      expect(brushParcel({ ...state, money: cost - 1 }, tool, 'arabicaStandard', a!)).toBe('money')
      expect(brushParcel({ ...state, money: cost }, tool, 'arabicaStandard', a!)).not.toBe('money')
    },
  )

  it('AC-1: harvest costs nothing and works with 0 CC', () => {
    expect(brushParcel({ ...ripe, money: 0 }, 'harvest', 'robusta', a!)).toEqual({
      type: 'Harvest',
      parcels: [a],
    })
  })
})

describe('strokeParcel (S40)', () => {
  it('AC-2: a stroke over A, B, A, C acts once per parcel and stops C with "money"', () => {
    const costA = quoteParcels(fresh, [a!])
    const afterA = { ...fresh, money: costA }
    const costB = quoteParcels(dispatch(afterA, { type: 'CreateParcels', parcels: [a!] }), [b!])
    let state: GameState = { ...fresh, money: costA + costB }
    const visited = new Set<number>()
    const results = []
    for (const p of [a!, b!, a!, c!]) {
      const result = strokeParcel(visited, state, 'parcel', 'robusta', p)
      results.push(result)
      if (typeof result === 'object') state = dispatch(state, result)
    }
    expect(results).toEqual([
      { type: 'CreateParcels', parcels: [a] },
      { type: 'CreateParcels', parcels: [b] },
      undefined,
      'money',
    ])
    expect(state.money).toBe(0)
    expect(Object.keys(state.farm.parcels)).toHaveLength(2)
  })
})

describe('isClick (S40)', () => {
  it('AC-4: a right-click that moves less than 4 px is a click, a longer move is a pan', () => {
    expect(isClick(0, 0)).toBe(true)
    expect(isClick(2, 2)).toBe(true)
    expect(isClick(4, 0)).toBe(false)
    expect(isClick(-30, 12)).toBe(false)
  })
})

describe('brushParcel with Specialty (S48, #17)', () => {
  const k = fresh.world.parcels.find((p) => p.zone === 'hochlandKuehl' && isFree(fresh, p.x, p.y))!
  const cool = { x: k.x, y: k.y }
  const bought = dispatch(
    { ...fresh, money: 2000000 },
    { type: 'CreateParcels', parcels: [a!, cool] },
  )

  it('AC-2: gives Plant for a lowland and a cool highland parcel from 10.000 CC', () => {
    // Capital is money plus the paid parcels.
    const state = { ...bought, money: 1000000 - bought.invested }
    for (const p of [a!, cool]) {
      const command = brushParcel(state, 'plant', 'specialty', p)
      expect(command).toEqual({ type: 'Plant', variety: 'specialty', parcels: [p] })
      expect(() => dispatch(state, command as Exclude<typeof command, string>)).not.toThrow()
    }
  })

  it('AC-2: gives "invalid" below 10.000 CC', () => {
    const state = { ...bought, money: 999999 - bought.invested }
    for (const p of [a!, cool]) expect(brushParcel(state, 'plant', 'specialty', p)).toBe('invalid')
  })
})
