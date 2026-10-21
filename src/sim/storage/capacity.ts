import { balance } from '../balance'
import type { GameState } from '../state'

// Each Lager-Ausbau is the next stage of storage.upgrades. A stage gives the total capacity.
const stages = (state: GameState) =>
  Object.values(state.buildings).filter((b) => b.kind === 'storage').length

export function storageCapacity(state: GameState, cfg = balance()): number {
  const { startCapacity, upgrades } = cfg.storage
  const n = Math.min(stages(state), upgrades.length)
  return n === 0 ? startCapacity : upgrades[n - 1]!.capacity
}

// Null after the last stage.
export function nextStorageCapacity(state: GameState, cfg = balance()): number | null {
  return cfg.storage.upgrades[stages(state)]?.capacity ?? null
}
