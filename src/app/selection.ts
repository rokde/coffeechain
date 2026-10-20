import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ParcelPos } from '../render/picking'
import { isBuildable } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'

// UI state, not sim state: the active tool, the inspector parcel and the parcel tool selection.
export const useSelectionStore = defineStore('selection', () => {
  const tool = ref('select')
  const parcel = ref<ParcelPos | null>(null)
  const parcels = ref<ParcelPos[]>([])
  watch(tool, () => (parcels.value = []), { flush: 'sync' })

  // Removes a selected parcel. Adds it only when it is buildable and the farm does not own it.
  function toggle(state: GameState, p: ParcelPos) {
    const rest = parcels.value.filter((q) => q.x !== p.x || q.y !== p.y)
    if (rest.length < parcels.value.length) parcels.value = rest
    else if (
      !(p.y * state.world.size + p.x in state.farm.parcels) &&
      isBuildable(state.world, p.x, p.y)
    )
      parcels.value = [...parcels.value, p]
  }

  return { tool, parcel, parcels, toggle }
})
