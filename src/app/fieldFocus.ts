import { fieldAnchors } from '../render/fields'
import type { GameState } from '../sim/state'
import type { useSelectionStore } from './selection'
import type { useViewStore } from './view'

// A field list click: the select tool selects and marks the field, and the camera centers on it.
export function focusField(
  state: GameState,
  fieldId: number,
  selection: ReturnType<typeof useSelectionStore>,
  view: ReturnType<typeof useViewStore>,
) {
  const { size } = state.world
  const parcels = Object.keys(state.farm.parcels)
    .map(Number)
    .filter((i) => state.farm.parcels[i] === fieldId)
    .sort((a, b) => a - b)
    .map((i) => ({ x: i % size, y: Math.floor(i / size) }))
  // The tool goes first, because a tool change clears the marks.
  selection.tool = 'select'
  selection.parcel = parcels[0] ?? null
  selection.parcels = parcels
  const anchor = fieldAnchors(state.world, state.farm, state.buildings).find(
    (a) => a.id === fieldId,
  )
  if (anchor) view.focus = { ...anchor.position }
}
