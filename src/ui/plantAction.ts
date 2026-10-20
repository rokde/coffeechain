import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import type { Variety } from '../sim/farm/yield'

// shortcut: only varieties with unlockCapital 0, use the capital check from S29.
export const plantVarieties = (Object.keys(balance().varieties) as Variety[]).filter(
  (v) => balance().varieties[v].unlockCapital === 0,
)

// Plants the chosen variety on the selected parcels and clears the selection.
export function plantSelected() {
  const selection = useSelectionStore()
  useGameStore().dispatch({
    type: 'Plant',
    variety: selection.variety,
    parcels: selection.parcels,
  })
  selection.parcels = []
}
