import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { serialize } from '../sim/save/save'
import { createState, type GameState } from '../sim/state'
import { writeSlot } from './saves'
import { parseSeed, pickSeed } from './seed'

export const useStartScreenStore = defineStore('startScreen', () => {
  // The readable autosave that the screen offers, or null. main.ts sets it before the mount.
  const save = shallowRef<GameState | null>(null)
  // True after the player confirmed a new game over the save.
  const newGame = ref(false)
  // True while the screen asks the player to confirm a new game.
  const confirmNewGame = ref(false)
  const seedText = ref(String(pickSeed('')))
  const seed = computed(() => parseSeed(seedText.value.trim()))
  const welcome = computed(() => save.value !== null && !newGame.value)
  // The game that the preview shows and the start button starts, or null for an invalid seed.
  const preview = computed(() =>
    welcome.value ? save.value : seed.value === null ? null : createState(seed.value),
  )

  function reroll() {
    seedText.value = String(pickSeed(''))
  }

  // True after the first play call. A second click must not start a second game.
  let starting = false
  // A new game over the confirmed save becomes the autosave, so the next launch does not offer the lost game.
  // Without a readable save the monthly autosave writes it, so an unreadable or newer save stays.
  async function play(): Promise<GameState | null> {
    const state = preview.value
    if (state === null || starting) return null
    starting = true
    if (welcome.value || save.value === null) return state
    try {
      await writeSlot('autosave', serialize(state))
    } catch (error) {
      console.error('Autosave of the new game failed', error)
    }
    return state
  }

  return { save, newGame, confirmNewGame, seedText, seed, welcome, preview, reroll, play }
})
