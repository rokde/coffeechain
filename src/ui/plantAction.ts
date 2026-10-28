import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import type { Variety } from '../sim/farm/yield'
import { isVarietyUnlocked } from '../sim/progression/capital'
import type { GameState } from '../sim/state'
import { validParcels } from './farmAction'

export const plantVarieties = Object.keys(balance().varieties) as Variety[]

// The valid selected parcels, or none while the variety is locked.
export const plantParcels = (state: GameState, variety: Variety) =>
  isVarietyUnlocked(state, variety) ? validParcels(state, 'plant') : []

// Plants the chosen variety on the valid selected parcels and clears the selection.
export function plantSelected() {
  const selection = useSelectionStore()
  const game = useGameStore()
  // plantParcels only reads the state, so the cast of the readonly snapshot is safe.
  const parcels = plantParcels(game.state as GameState, selection.variety)
  if (parcels.length > 0) game.dispatch({ type: 'Plant', variety: selection.variety, parcels })
  selection.parcels = []
}
