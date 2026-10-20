import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import type { Variety } from '../sim/farm/yield'
import type { GameState } from '../sim/state'
import { validParcels } from './farmAction'

// shortcut: only varieties with unlockCapital 0, use the capital check from S29.
export const plantVarieties = (Object.keys(balance().varieties) as Variety[]).filter(
  (v) => balance().varieties[v].unlockCapital === 0,
)

// Plants the chosen variety on the valid selected parcels and clears the selection.
export function plantSelected() {
  const selection = useSelectionStore()
  const game = useGameStore()
  // validParcels only reads the state, so the cast of the readonly snapshot is safe.
  const parcels = validParcels(game.state as GameState, 'plant')
  if (parcels.length > 0) game.dispatch({ type: 'Plant', variety: selection.variety, parcels })
  selection.parcels = []
}
