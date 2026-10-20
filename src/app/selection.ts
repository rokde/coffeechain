import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ParcelPos } from '../render/picking'
import { cares } from '../sim/farm/care'
import { isFree } from '../sim/farm/parcels'
import { growth } from '../sim/farm/plants'
import type { Variety } from '../sim/farm/yield'
import type { GameState } from '../sim/state'

// The command that each farm tool sends with the selected parcels.
export const farmTools = {
  fertilize: 'Fertilize',
  irrigate: 'Irrigate',
  protect: 'ProtectPests',
  harvest: 'Harvest',
} as const
export type FarmTool = keyof typeof farmTools
export const isFarmTool = (tool: string): tool is FarmTool => tool in farmTools

export type BrushTool = 'parcel' | 'plant' | FarmTool
export const isBrushTool = (tool: string): tool is BrushTool =>
  tool === 'parcel' || tool === 'plant' || isFarmTool(tool)

// The plant tool selects only owned parcels without a plant.
// The harvest tool selects only owned parcels with a ripe plant.
// A care tool selects only owned parcels with an unripe plant that does not have this care yet.
// The other tools select only free parcels that the farm does not own.
export function canSelect(state: GameState, tool: string, p: ParcelPos): boolean {
  const index = p.y * state.world.size + p.x
  const owned = index in state.farm.parcels
  const plant = state.farm.plants[index]
  const ripe = plant !== undefined && growth(plant, state.time.hour).progress >= 1
  if (tool === 'plant') return owned && !plant
  if (tool === 'harvest') return owned && ripe
  if (tool === 'fertilize' || tool === 'irrigate' || tool === 'protect')
    return owned && !!plant && !ripe && !plant[cares[farmTools[tool]].flag]
  return !owned && isFree(state, p.x, p.y)
}

// UI state, not sim state: the active tool, the inspector parcel, the tool selection, the plant variety
// and the note of the last skipped brush parcel.
export const useSelectionStore = defineStore('selection', () => {
  const tool = ref('select')
  const parcel = ref<ParcelPos | null>(null)
  const parcels = ref<ParcelPos[]>([])
  const variety = ref<Variety>('robusta')
  const note = ref<'invalid' | 'money' | null>(null)
  watch(
    tool,
    (id) => {
      // pickTool filters the marks for a brush tool. The other tools do not use marks.
      if (!isBrushTool(id)) parcels.value = []
      note.value = null
    },
    { flush: 'sync' },
  )

  // Removes a selected parcel, or adds it when canSelect allows it.
  function toggle(state: GameState, p: ParcelPos) {
    const rest = parcels.value.filter((q) => q.x !== p.x || q.y !== p.y)
    if (rest.length < parcels.value.length) parcels.value = rest
    else if (canSelect(state, tool.value, p)) parcels.value = [...parcels.value, p]
  }

  return { tool, parcel, parcels, variety, note, toggle }
})

const samePos = (a: ParcelPos, b: ParcelPos) => a.x === b.x && a.y === b.y

// All parcels of the grid rectangle with the corners a and b.
export function parcelRect(a: ParcelPos, b: ParcelPos): ParcelPos[] {
  const rect: ParcelPos[] = []
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++)
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) rect.push({ x, y })
  return rect
}

// The marks after a click with the select tool. Shift adds p, or removes it when it is already marked.
export function markParcel(marks: ParcelPos[], p: ParcelPos, shift: boolean): ParcelPos[] {
  if (!shift) return [p]
  const rest = marks.filter((q) => !samePos(q, p))
  return rest.length < marks.length ? rest : [...marks, p]
}

// The marks plus the parcels of the rectangle, without duplicates.
export const addMarks = (marks: ParcelPos[], add: ParcelPos[]) => [
  ...marks,
  ...add.filter((p) => !marks.some((q) => samePos(q, p))),
]

// A toolbar click. A brush tool keeps only the marks that it can act on.
export function pickTool(
  selection: ReturnType<typeof useSelectionStore>,
  state: GameState,
  id: string,
) {
  selection.tool = id
  if (isBrushTool(id)) selection.parcels = selection.parcels.filter((p) => canSelect(state, id, p))
}
