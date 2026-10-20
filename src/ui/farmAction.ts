import { farmTools, useSelectionStore, type FarmTool } from '../app/selection'
import { useGameStore } from '../app/store'

// Sends the command of the farm tool with the selected parcels and clears the selection.
export function farmSelected(tool: FarmTool) {
  const selection = useSelectionStore()
  useGameStore().dispatch({ type: farmTools[tool], parcels: selection.parcels })
  selection.parcels = []
}
