import { defineStore } from 'pinia'
import { ref } from 'vue'

// UI state, not sim state: the selected parcel of the inspector.
export const useSelectionStore = defineStore('selection', () => {
  const parcel = ref<{ x: number; y: number } | null>(null)
  return { parcel }
})
