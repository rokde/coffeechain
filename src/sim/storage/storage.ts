import { balance } from '../balance'
import type { Variety } from '../farm/yield'

export interface Batch {
  variety: Variety
  units: number
  quality: number
  // The calendar day the batch came into storage. Washing keeps it.
  storedDay: number
  // Washed batches only: the bank buys them from this calendar day on.
  washed?: true
  readyDay?: number
}

export interface StorageState {
  batches: Batch[]
}

export function storageUsed(state: StorageState): number {
  return state.batches.reduce((sum, batch) => sum + batch.units, 0)
}

// Full months a batch has been in storage on that day.
export const ageMonths = (batch: Batch, day: number, cfg = balance()) =>
  Math.floor((day - batch.storedDay) / cfg.time.daysPerMonth)

// Quality points a batch of that age loses at a month turn. The loss grows with the age.
export function monthlyLoss(age: number, cfg = balance()): number {
  const stages = cfg.storage.qualityLossByAge
  return [...stages].reverse().find((s) => age >= s.fromMonth)?.loss ?? stages[0]!.loss
}
