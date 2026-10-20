import { balance } from '../balance'
import type { Variety } from '../farm/yield'
import { bankBuyPrice } from '../market/market'
import type { GameState } from '../state'

// PRD §10: balance + stock at the bank buy price + paid parcels and buildings. Hundredths of CC.
export function capital(state: GameState): number {
  const stock = state.storage.batches.reduce(
    (sum, b) => sum + b.units * bankBuyPrice(state, b.variety),
    0,
  )
  return state.money + Math.round(stock * 100) + state.invested
}

export function phase(state: GameState): number {
  const cc = capital(state) / 100
  return balance().progression.phases.reduce((id, p) => (p.fromCapital <= cc ? p.id : id), 1)
}

// next is the threshold of the next phase in CC. share is the way from the current threshold to it, 0 to 1.
export function phaseProgress(state: GameState): { next: number | null; share: number } {
  const phases = balance().progression.phases
  const i = phases.findIndex((p) => p.id === phase(state))
  const next = phases[i + 1]
  if (!next) return { next: null, share: 1 }
  const from = phases[i]!.fromCapital
  const share = (capital(state) / 100 - from) / (next.fromCapital - from)
  return { next: next.fromCapital, share: Math.min(1, Math.max(0, share)) }
}

export function isVarietyUnlocked(state: GameState, variety: Variety): boolean {
  return capital(state) / 100 >= balance().varieties[variety].unlockCapital
}
