import type { Variety } from '../farm/yield'

export interface Batch {
  variety: Variety
  units: number
  quality: number
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
