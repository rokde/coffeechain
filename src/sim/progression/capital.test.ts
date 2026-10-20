import { describe, expect, it } from 'vitest'
import { buildMenu } from '../buildings/build'
import { dispatch } from '../commands'
import { isFree } from '../farm/parcels'
import { deserialize } from '../save/save'
import { createState, type GameState } from '../state'
import { capital, isVarietyUnlocked, phase, phaseProgress } from './capital'

// A new game with the given balance in hundredths of CC and no stock or investment.
const withMoney = (money: number): GameState => ({ ...createState(1), money })

describe('capital (S47)', () => {
  it('AC-1: adds balance, stock at the bank buy price and the invested amount', () => {
    const state: GameState = {
      ...withMoney(100_000),
      storage: { batches: [{ variety: 'robusta', units: 10, quality: 100 }] },
      invested: 5_000,
    }
    expect(capital(state)).toBe(105_400)
  })

  it('AC-2: CreateParcels and Build move money into invested, the capital stays', () => {
    const base = withMoney(1_000_000)
    const [p] = base.world.parcels.filter((p) => p.zone === 'tiefland' && isFree(base, p.x, p.y))
    const bought = dispatch(base, { type: 'CreateParcels', parcels: [{ x: p!.x, y: p!.y }] })
    expect(bought.money).toBeLessThan(base.money)
    expect(bought.invested).toBe(base.money - bought.money)
    expect(capital(bought)).toBe(capital(base))
    const built = dispatch(bought, { type: 'Build', building: 'storage', parcel: p! })
    expect(built.money).toBeLessThan(bought.money)
    expect(built.invested - bought.invested).toBe(bought.money - built.money)
    expect(capital(built)).toBe(capital(base))
  })
})

describe('phase (S47)', () => {
  it.each([
    [199_999, 1],
    [200_000, 2],
    [999_999, 2],
    [1_000_000, 3],
  ])('AC-3: %i hundredths of CC give phase %i', (money, expected) => {
    expect(phase(withMoney(money))).toBe(expected)
  })

  it('AC-3: gives the next threshold and the share of the way to it', () => {
    expect(phaseProgress(withMoney(125_000))).toEqual({ next: 2000, share: 0.625 })
    expect(phaseProgress(withMoney(600_000))).toEqual({ next: 10000, share: 0.5 })
    expect(phaseProgress(withMoney(1_000_000)).next).toBeNull()
  })
})

describe('unlocks (S47)', () => {
  // Owns one lowland parcel.
  const owned = (money: number) => {
    const base = withMoney(1_000_000)
    const [p] = base.world.parcels.filter((p) => p.zone === 'tiefland' && isFree(base, p.x, p.y))
    const state = dispatch(base, { type: 'CreateParcels', parcels: [{ x: p!.x, y: p!.y }] })
    return { state: { ...state, money: money - state.invested }, parcel: { x: p!.x, y: p!.y } }
  }
  const plant = (state: GameState, parcel: { x: number; y: number }) =>
    dispatch(state, { type: 'Plant', variety: 'arabicaPremium', parcels: [parcel] })

  it('AC-4: Plant with Arabica Premium needs 2.000 CC capital', () => {
    const below = owned(199_999)
    expect(capital(below.state)).toBe(199_999)
    expect(isVarietyUnlocked(below.state, 'arabicaPremium')).toBe(false)
    expect(() => plant(below.state, below.parcel)).toThrow(/locked/)
    const at = owned(200_000)
    expect(isVarietyUnlocked(at.state, 'arabicaPremium')).toBe(true)
    expect(plant(at.state, at.parcel).farm.plants).not.toEqual({})
  })

  it('AC-4: buildMenu locks the phase 2 storage stage in phase 1 only', () => {
    const storage = (state: GameState) => buildMenu(state).find((e) => e.kind === 'storage')!
    const stage2 = (money: number): GameState => ({
      ...withMoney(money),
      buildings: { 0: { kind: 'storage' } },
    })
    expect(storage(stage2(199_999))).toMatchObject({ requiredPhase: 2, locked: true })
    expect(storage(stage2(200_000))).toMatchObject({ requiredPhase: 2, locked: false })
  })
})

describe('save (S47)', () => {
  it('AC-5: loads a version 5 save with invested 0', () => {
    const old: Record<string, unknown> = { ...createState(5) }
    delete old.invested
    const loaded = deserialize(JSON.stringify({ version: 5, state: old }))
    expect(loaded.invested).toBe(0)
    expect(loaded).toEqual(createState(5))
  })
})
