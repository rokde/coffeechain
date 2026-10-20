import { defineStore } from 'pinia'
import { readonly, shallowRef } from 'vue'
import { createState } from '../sim/state'

// The HUD reads the sim state here. Only the game loop replaces the snapshot.
export const useGameStore = defineStore('game', () => {
  const snapshot = shallowRef(createState())
  return { state: readonly(snapshot) }
})
