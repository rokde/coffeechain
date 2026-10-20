import { canSelect, farmTools, useSelectionStore, type FarmTool } from '../app/selection'
import { useGameStore } from '../app/store'
import { fieldStatus, type CareCommand } from '../sim/farm/status'
import type { GameState } from '../sim/state'

// The selected parcels that the tool still accepts. The game runs on, so a plant can turn ripe after the click.
export function validParcels(state: GameState, tool: FarmTool) {
  return useSelectionStore().parcels.filter((p) => canSelect(state, tool, p))
}

// Sends the command of the farm tool with the valid selected parcels and clears the selection.
export function farmSelected(tool: FarmTool) {
  const game = useGameStore()
  // validParcels only reads the state, so the cast of the readonly snapshot is safe.
  const parcels = validParcels(game.state as GameState, tool)
  if (parcels.length > 0) game.dispatch({ type: farmTools[tool], parcels })
  useSelectionStore().parcels = []
}

// Sends one care for one parcel. The game runs on, so the plant can turn ripe after the render.
export function careParcel(command: CareCommand, parcel: { x: number; y: number }) {
  const game = useGameStore()
  // fieldStatus only reads the state, so the cast of the readonly snapshot is safe.
  const status = fieldStatus(game.state as GameState, parcel.x, parcel.y)
  if (status?.open.includes(command)) game.dispatch({ type: command, parcels: [parcel] })
}
