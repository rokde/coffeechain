import type { Balance } from '../../../config/balance.schema'
import { balance } from '../balance'
import type { Variety } from '../farm/yield'
import { roundCost } from '../money'
import type { GameState } from '../state'
import { storageCapacity } from './capacity'
import { ageMonths, monthlyLoss, storageUsed, type Batch, type StorageState } from './storage'

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
  storedDay: number
  // Full months in storage today.
  age: number
  // Quality points the next month turn takes.
  loss: number
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

// Month turns from today until the quality falls below min: -1 if it is already below,
// null if it never falls (no loss within 100 years).
function shelfMonths(b: Batch, today: number, min: number, cfg: Balance): number | null {
  if (b.quality < min) return -1
  const { daysPerMonth } = cfg.time
  let quality = b.quality
  for (let turn = 1; turn <= 1200; turn++) {
    const day = (Math.floor(today / daysPerMonth) + turn) * daysPerMonth
    quality -= monthlyLoss(ageMonths(b, day, cfg), cfg)
    if (quality < min) return turn - 1
  }
  return null
}

// Merges batches with the same variety, state, quality, storage day and ready day into one row.
// Groups follow the variety order of the config. Raw rows come first, then the higher quality,
// then the older batch.
export function storageOverview(state: GameState, cfg = balance()): StorageOverview {
  const { daysPerMonth } = cfg.time
  const { costPerUnitPerMonth, shelfLifeMinQuality: min } = cfg.storage
  const today = state.time.day
  const month = Math.floor(today / daysPerMonth)
  const rows = new Map<string, OverviewRow>()
  for (const b of state.storage.batches) {
    const washed = b.washed === true
    const key = [b.variety, washed, b.quality, b.storedDay, b.readyDay].join('|')
    const row = rows.get(key)
    if (row) {
      row.units += b.units
      continue
    }
    const shelf = shelfMonths(b, today, min, cfg)
    rows.set(key, {
      variety: b.variety,
      washed,
      units: b.units,
      quality: b.quality,
      storedDay: b.storedDay,
      age: ageMonths(b, today, cfg),
      loss: monthlyLoss(ageMonths(b, (month + 1) * daysPerMonth, cfg), cfg),
      ...(b.readyDay !== undefined && { readyDay: b.readyDay }),
      cost: 0,
      shelfMonths: shelf,
      shelfUntilDay: shelf === null || shelf < 0 ? null : (month + shelf + 1) * daysPerMonth - 1,
    })
  }
  for (const row of rows.values()) row.cost = row.units * costPerUnitPerMonth * 100
  const groups = (Object.keys(cfg.varieties) as Variety[])
    .map((variety) => {
      const list = [...rows.values()]
        .filter((r) => r.variety === variety)
        .sort(
          (a, b) =>
            Number(a.washed) - Number(b.washed) ||
            b.quality - a.quality ||
            a.storedDay - b.storedDay,
        )
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
