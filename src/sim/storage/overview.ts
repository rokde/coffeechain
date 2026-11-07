import { balance } from '../balance'
import type { Variety } from '../farm/yield'
import { roundCost } from '../money'
import type { GameState } from '../state'
import { storageCapacity } from './capacity'
import { storageUsed, type StorageState } from './storage'

// The storage cost of one month in hundredths of CC, before the booking rounds it up.
export const monthlyStorageCostExact = (storage: StorageState, cfg = balance()) =>
  storageUsed(storage) * cfg.storage.costPerUnitPerMonth * 100

// The storage cost that the next month turn books, in whole CC (as hundredths).
export const monthlyStorageCost = (storage: StorageState, cfg = balance()) =>
  roundCost(Math.round(monthlyStorageCostExact(storage, cfg)))

export interface OverviewRow {
  variety: Variety
  washed: boolean
  units: number
  quality: number
  // Washed batches only.
  readyDay?: number
  // Hundredths of CC per month, not rounded.
  cost: number
  // Month turns until the quality falls below the threshold: 0 or more while it holds,
  // negative once it is below, null if the quality never drops.
  shelfMonths: number | null
  // The last day of the last month in which the quality still holds, or null.
  shelfUntilDay: number | null
}

export interface OverviewGroup {
  variety: Variety
  units: number
  rows: OverviewRow[]
}

export interface StorageOverview {
  capacity: number
  raw: number
  washed: number
  free: number
  nextMonthDay: number
  cost: number
  costExact: number
  groups: OverviewGroup[]
}

// Merges batches with the same variety, state, quality and ready day into one row.
// Groups follow the variety order of the config. Raw rows come first, then the higher quality.
export function storageOverview(state: GameState, cfg = balance()): StorageOverview {
  const { daysPerMonth } = cfg.time
  const { costPerUnitPerMonth, qualityLossPerMonth: loss, shelfLifeMinQuality: min } = cfg.storage
  const today = state.time.day
  const month = Math.floor(today / daysPerMonth)
  const rows = new Map<string, OverviewRow>()
  for (const b of state.storage.batches) {
    const washed = b.washed === true
    const key = [b.variety, washed, b.quality, b.readyDay].join('|')
    const row = rows.get(key)
    if (row) {
      row.units += b.units
      continue
    }
    const shelfMonths = loss > 0 ? Math.floor((b.quality - min) / loss) : null
    rows.set(key, {
      variety: b.variety,
      washed,
      units: b.units,
      quality: b.quality,
      ...(b.readyDay !== undefined && { readyDay: b.readyDay }),
      cost: 0,
      shelfMonths,
      shelfUntilDay:
        shelfMonths === null || shelfMonths < 0
          ? null
          : (month + shelfMonths + 1) * daysPerMonth - 1,
    })
  }
  for (const row of rows.values()) row.cost = row.units * costPerUnitPerMonth * 100
  const groups = (Object.keys(cfg.varieties) as Variety[])
    .map((variety) => {
      const list = [...rows.values()]
        .filter((r) => r.variety === variety)
        .sort((a, b) => Number(a.washed) - Number(b.washed) || b.quality - a.quality)
      return { variety, units: list.reduce((s, r) => s + r.units, 0), rows: list }
    })
    .filter((g) => g.rows.length > 0)
  const washed = state.storage.batches.reduce((s, b) => s + (b.washed ? b.units : 0), 0)
  const used = storageUsed(state.storage)
  const capacity = storageCapacity(state, cfg)
  return {
    capacity,
    raw: used - washed,
    washed,
    free: Math.max(0, capacity - used),
    nextMonthDay: (month + 1) * daysPerMonth,
    cost: monthlyStorageCost(state.storage, cfg),
    costExact: monthlyStorageCostExact(state.storage, cfg),
    groups,
  }
}
