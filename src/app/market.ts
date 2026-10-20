import { balance } from '../sim/balance'
import type { Variety } from '../sim/farm/yield'
import { isRunning } from '../sim/processing/process'
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

const units = (state: GameState, variety: Variety, washed: boolean) =>
  state.storage.batches
    .filter((b) => b.variety === variety && (b.washed === true) === washed)
    .filter((b) => !isRunning(b, state.time.hour))
    .reduce((sum, b) => sum + b.units, 0)

// Raw units of one variety in storage.
export const storedUnits = (state: GameState, variety: Variety) => units(state, variety, false)

// Ready washed units of one variety in storage.
export const washedUnits = (state: GameState, variety: Variety) => units(state, variety, true)

// Sells all stored units of one variety to the bank.
export function sellAll(game: ReturnType<typeof useGameStore>, variety: Variety) {
  // storedUnits only reads the state, so the cast of the readonly snapshot is safe.
  const units = storedUnits(game.state as GameState, variety)
  if (units > 0) game.dispatch({ type: 'Sell', variety, units })
}

// Sells all ready washed units of one variety to the bank.
export function sellAllWashed(game: ReturnType<typeof useGameStore>, variety: Variety) {
  const units = washedUnits(game.state as GameState, variety)
  if (units > 0) game.dispatch({ type: 'Sell', variety, units, washed: true })
}

// Units that "Aufbereiten" processes: the raw stock, at most one full batch.
export const processUnits = (state: GameState, variety: Variety) =>
  Math.min(storedUnits(state, variety), balance().processing.washed.batchCapacity)

// Washes raw units of one variety, at most one full batch.
export function processAll(game: ReturnType<typeof useGameStore>, variety: Variety) {
  const units = processUnits(game.state as GameState, variety)
  if (units > 0) game.dispatch({ type: 'Process', variety, units })
}
