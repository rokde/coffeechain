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

  const fpsVisible = ref(false)
  const fps = ref(0)
  function toggleFps() {
    fpsVisible.value = !fpsVisible.value
  }

  // The point that the camera must center on. Each request is a new object.
  const focus = ref<{ x: number; y: number; z: number } | null>(null)

  return { overlay, toggle, helpOpen, toggleHelp, fpsVisible, fps, toggleFps, focus }
})
