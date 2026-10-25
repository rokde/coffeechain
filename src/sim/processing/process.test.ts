import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { dispatch } from '../commands'
import { marketPrice } from '../market/market'
import { createState, type GameState } from '../state'
import type { Batch } from '../storage/storage'

const day = balance().processing.washed.durationDays

// A farm with a processing building, 10 raw Arabica Standard units and 1,000 CC.
function processingState(batches: Batch[] = []): GameState {
  const state = createState(1)
  return {
    ...state,
    money: 100_000,
    buildings: { 0: { kind: 'processing' } },
    storage: {
      batches: [{ variety: 'arabicaStandard', units: 10, quality: 90 }, ...batches],
    },
  }
}

const raw = (state: GameState) =>
  state.storage.batches.filter((b) => !b.washed).reduce((sum, b) => sum + b.units, 0)
const washed = (state: GameState) =>
  state.storage.batches.filter((b) => b.washed).reduce((sum, b) => sum + b.units, 0)

describe('Process (S46)', () => {
  it('AC-1: 10 raw Arabica Standard units cost 3 CC and become washed at 1.5 CC', () => {
    const state = processingState()
    const next = dispatch(state, { type: 'Process', variety: 'arabicaStandard', units: 10 })
    expect(next.money).toBe(state.money - 300)
    expect(raw(next)).toBe(0)
    expect(washed(next)).toBe(10)
    expect(next.storage.batches).toEqual([
      { variety: 'arabicaStandard', units: 10, quality: 90, washed: true, readyDay: day },
    ])
    const market = { volumes: [], seeds: {} }
    expect(marketPrice(market, { kind: 'washed', variety: 'arabicaStandard' }, 1)).toBeCloseTo(1.5)
    expect(marketPrice(market, { kind: 'coffee', variety: 'arabicaStandard' }, 1)).toBeCloseTo(1.0)
  })

  it('AC-1: takes the oldest raw batches first and keeps their quality', () => {
    const state = processingState([{ variety: 'arabicaStandard', units: 10, quality: 100 }])
    const next = dispatch(state, { type: 'Process', variety: 'arabicaStandard', units: 15 })
    expect(next.storage.batches).toEqual([
      { variety: 'arabicaStandard', units: 5, quality: 100 },
      { variety: 'arabicaStandard', units: 10, quality: 90, washed: true, readyDay: day },
      { variety: 'arabicaStandard', units: 5, quality: 100, washed: true, readyDay: day },
    ])
  })

  it('AC-2: throws and keeps the state for bad commands', () => {
    const big = processingState([{ variety: 'arabicaStandard', units: 100, quality: 100 }])
    const running = dispatch(processingState(), {
      type: 'Process',
      variety: 'arabicaStandard',
      units: 5,
    })
    const cases: [GameState, number, RegExp][] = [
      [{ ...processingState(), buildings: { 0: { kind: 'storage' } } }, 5, /no processing/],
      [big, 51, /capacity/],
      [processingState(), 11, /Not enough raw/],
      [{ ...processingState(), money: 299 }, 10, /Not enough money/],
      [running, 5, /still running/],
      [processingState(), 0, /positive integer/],
      [processingState(), 2.5, /positive integer/],
    ]
    for (const [state, units, error] of cases) {
      const copy = structuredClone(state)
      expect(() => dispatch(state, { type: 'Process', variety: 'arabicaStandard', units })).toThrow(
        error,
      )
      expect(state).toEqual(copy)
    }
  })

  it('AC-2: allows a new batch after the running batch is ready', () => {
    const first = dispatch(processingState(), {
      type: 'Process',
      variety: 'arabicaStandard',
      units: 5,
    })
    const later = { ...first, time: { ...first.time, day } }
    const next = dispatch(later, { type: 'Process', variety: 'arabicaStandard', units: 5 })
    expect(washed(next)).toBe(10)
  })
})
