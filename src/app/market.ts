import type { Variety } from '../sim/farm/yield'
import type { GameState } from '../sim/state'
import type { useSelectionStore } from './selection'
import type { useGameStore } from './store'

// True when the parcel is the market stand parcel.
export function isMarketStand(state: GameState, parcel: { x: number; y: number } | null): boolean {
  const { market } = state.props
  return parcel !== null && parcel.x === market.x && parcel.y === market.y
}

// Select tool click: the market stand opens the market and clears the selection, other clicks select.
export function selectParcel(
  selection: ReturnType<typeof useSelectionStore>,
  state: GameState,
  parcel: { x: number; y: number } | null,
) {
  const market = isMarketStand(state, parcel)
  if (market) selection.tool = 'market'
  selection.parcel = market ? null : parcel
}

// Units of one variety in storage.
export const storedUnits = (state: GameState, variety: Variety) =>
  state.storage.batches.filter((b) => b.variety === variety).reduce((sum, b) => sum + b.units, 0)

// Sells all stored units of one variety to the bank.
export function sellAll(game: ReturnType<typeof useGameStore>, variety: Variety) {
  // storedUnits only reads the state, so the cast of the readonly snapshot is safe.
  const units = storedUnits(game.state as GameState, variety)
  if (units > 0) game.dispatch({ type: 'Sell', variety, units })
}
