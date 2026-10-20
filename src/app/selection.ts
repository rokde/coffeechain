import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ParcelPos } from '../render/picking'
import { isBuildable } from '../sim/farm/parcels'
import type { Variety } from '../sim/farm/yield'
import type { GameState } from '../sim/state'

// UI state, not sim state: the active tool, the inspector parcel, the tool selection and the plant variety.
export const useSelectionStore = defineStore('selection', () => {
  const tool = ref('select')
  const parcel = ref<ParcelPos | null>(null)
  const parcels = ref<ParcelPos[]>([])
  const variety = ref<Variety>('robusta')
  watch(tool, () => (parcels.value = []), { flush: 'sync' })

  // Removes a selected parcel. The plant tool adds only owned parcels without a plant.
  // The other tools add only buildable parcels that the farm does not own.
  function toggle(state: GameState, p: ParcelPos) {
    const rest = parcels.value.filter((q) => q.x !== p.x || q.y !== p.y)
    const index = p.y * state.world.size + p.x
    const owned = index in state.farm.parcels
    const allowed =
      tool.value === 'plant'
        ? owned && !(index in state.farm.plants)
        : !owned && isBuildable(state.world, p.x, p.y)
    if (rest.length < parcels.value.length) parcels.value = rest
    else if (allowed) parcels.value = [...parcels.value, p]
  }

  return { tool, parcel, parcels, variety, toggle }
})
