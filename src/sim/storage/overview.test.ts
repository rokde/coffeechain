import { describe, expect, it } from 'vitest'
import { balance } from '../balance'
import { createState, type GameState } from '../state'
import { monthlyLoss, type Batch } from './storage'
import { monthlyStorageCost, storageOverview } from './overview'

const cfg = balance()
const min = cfg.storage.shelfLifeMinQuality
const month = cfg.time.daysPerMonth

// Day 71: 12 March, year 1 with 30-day months.
function withBatches(batches: Batch[], day = 2 * month + 11): GameState {
  const state = createState(1)
  return { ...state, time: { ...state.time, day }, storage: { batches } }
}

describe('monthlyLoss', () => {
  it('#9: follows the age stages of the config', () => {
    for (const stage of cfg.storage.qualityLossByAge) {
      expect(monthlyLoss(stage.fromMonth)).toBe(stage.loss)
      expect(monthlyLoss(stage.fromMonth + 1)).toBe(stage.loss)
    }
  })
})

describe('storageOverview', () => {
  it('AC-1: merges batches of the same variety, state and quality', () => {
    const o = storageOverview(
      withBatches([
        { variety: 'robusta', units: 10, quality: 80, storedDay: 0 },
        { variety: 'robusta', units: 5, quality: 80, storedDay: 0 },
        { variety: 'robusta', units: 4, quality: 75, storedDay: 0 },
        { variety: 'robusta', units: 3, quality: 80, storedDay: 0, washed: true, readyDay: 90 },
        { variety: 'robusta', units: 2, quality: 80, storedDay: 0, washed: true, readyDay: 95 },
      ]),
    )
    expect(o.groups).toHaveLength(1)
    expect(o.groups[0]!.units).toBe(24)
    expect(o.groups[0]!.rows.map((r) => [r.washed, r.units, r.quality, r.readyDay])).toEqual([
      [false, 15, 80, undefined],
      [false, 4, 75, undefined],
      [true, 3, 80, 90],
      [true, 2, 80, 95],
    ])
  })

  it('AC-2: groups follow the variety order of the config', () => {
    const o = storageOverview(
      withBatches([
        { variety: 'arabicaStandard', units: 1, quality: 80, storedDay: 0 },
        { variety: 'robusta', units: 1, quality: 80, storedDay: 0 },
      ]),
    )
    const order = Object.keys(cfg.varieties)
    expect(o.groups.map((g) => g.variety)).toEqual(
      ['robusta', 'arabicaStandard'].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    )
  })

  it.each([
    // quality above the threshold, months until it drops below, month of the last day
    // Fresh coffee loses 1 per month for 6 months, then 2: 12 points last 9 turns.
    [min + 12, 9],
    [min + 4, 4],
    [min, 0],
    [min - 1, -1],
  ])('AC-3: quality %i keeps for %i month turns', (quality, months) => {
    const today = 2 * month + 11
    const batch = { variety: 'robusta' as const, units: 1, quality, storedDay: today }
    const row = storageOverview(withBatches([batch])).groups[0]!.rows[0]!
    expect(row.shelfMonths).toBe(months)
    // Today is in month 2 (March). It holds until the end of month 2 + months.
    expect(row.shelfUntilDay).toBe(months < 0 ? null : (3 + months) * month - 1)
  })

  it('AC-4: sums units, capacity, the next month turn and the cost', () => {
    const o = storageOverview(
      withBatches([
        { variety: 'robusta', units: 60, quality: 80, storedDay: 0 },
        { variety: 'robusta', units: 40, quality: 80, storedDay: 0, washed: true, readyDay: 0 },
      ]),
    )
    expect(o).toMatchObject({ raw: 60, washed: 40, capacity: 100, free: 0, nextMonthDay: 90 })
    expect(o.costExact).toBeCloseTo(100 * cfg.storage.costPerUnitPerMonth * 100)
    expect(o.cost).toBe(
      monthlyStorageCost({
        batches: [{ variety: 'robusta', units: 100, quality: 1, storedDay: 0 }],
      }),
    )
    expect(o.groups[0]!.rows[0]!.cost).toBeCloseTo(60 * cfg.storage.costPerUnitPerMonth * 100)
  })

  it('#9: splits batches of different storage days and shows their age', () => {
    const rows = storageOverview(
      withBatches([
        { variety: 'robusta', units: 10, quality: 80, storedDay: 0 },
        { variety: 'robusta', units: 5, quality: 80, storedDay: 2 * month },
      ]),
    ).groups[0]!.rows
    expect(rows.map((r) => [r.units, r.age])).toEqual([
      [10, 2],
      [5, 0],
    ])
  })

  it('AC-5: an empty storage has no groups', () => {
    expect(storageOverview(withBatches([])).groups).toEqual([])
  })
})
