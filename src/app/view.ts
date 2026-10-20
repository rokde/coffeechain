import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { OverlayMode } from '../render/overlays'

// View state only, so it does not go through the sim commands.
export const useViewStore = defineStore('view', () => {
  const overlay = ref<OverlayMode>('none')

  // Only one overlay is on at a time. A second toggle of the same mode turns it off.
  function toggle(mode: Exclude<OverlayMode, 'none'>) {
    overlay.value = overlay.value === mode ? 'none' : mode
  }

  const helpOpen = ref(false)
  function toggleHelp() {
    helpOpen.value = !helpOpen.value
  }

  return { overlay, toggle, helpOpen, toggleHelp }
})
