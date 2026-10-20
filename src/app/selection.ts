import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ParcelPos } from '../render/picking'
import { cares } from '../sim/farm/care'
import { isBuildable } from '../sim/farm/parcels'
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

// UI state, not sim state: the active tool, the inspector parcel, the tool selection and the plant variety.
export const useSelectionStore = defineStore('selection', () => {
  const tool = ref('select')
  const parcel = ref<ParcelPos | null>(null)
  const parcels = ref<ParcelPos[]>([])
  const variety = ref<Variety>('robusta')
  watch(tool, () => (parcels.value = []), { flush: 'sync' })

  // Removes a selected parcel. The plant tool adds only owned parcels without a plant.
  // The harvest tool adds only owned parcels with a ripe plant.
  // A care tool adds only owned parcels with an unripe plant that does not have this care yet.
  // The other tools add only buildable parcels that the farm does not own.
  function toggle(state: GameState, p: ParcelPos) {
    const rest = parcels.value.filter((q) => q.x !== p.x || q.y !== p.y)
    const index = p.y * state.world.size + p.x
    const owned = index in state.farm.parcels
    const plant = state.farm.plants[index]
    const ripe = plant !== undefined && growth(plant, state.time.hour).progress >= 1
    const t = tool.value
    const allowed =
      t === 'plant'
        ? owned && !plant
        : t === 'harvest'
          ? owned && ripe
          : t === 'fertilize' || t === 'irrigate' || t === 'protect'
            ? owned && !!plant && !ripe && !plant[cares[farmTools[t]].flag]
            : !owned && isBuildable(state.world, p.x, p.y)
    if (rest.length < parcels.value.length) parcels.value = rest
    else if (allowed) parcels.value = [...parcels.value, p]
  }

  return { tool, parcel, parcels, variety, toggle }
})
