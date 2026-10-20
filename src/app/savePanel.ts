import { defineStore } from 'pinia'
import { ref } from 'vue'
import { deserialize, serialize } from '../sim/save/save'
import { createState, type GameState } from '../sim/state'
import { clock } from '../sim/time/time'
import { errorMessage, loadSlot, pendingLoadError, readSlot, writeSlot } from './saves'
import { pickSeed } from './seed'
import { useGameStore } from './store'

export const slots = ['slot-1', 'slot-2', 'slot-3'] as const
export type Slot = (typeof slots)[number] | 'autosave'
export type SlotStatus = { day: number } | 'empty' | 'invalid'
// key: the text key in de.json savePanel.
export type SaveMessage =
  { key: 'saveFailed' | 'loadFailed'; reason: string } | { key: 'invalidPending' }

export const useSavePanelStore = defineStore('savePanel', () => {
  const game = useGameStore()
  const invalidPending = pendingLoadError() !== null
  const open = ref(invalidPending)
  const status = ref<Partial<Record<Slot, SlotStatus>>>({})
  const message = ref<SaveMessage | null>(invalidPending ? { key: 'invalidPending' } : null)
  // True while the panel asks the player to confirm a new game.
  const confirmNewGame = ref(false)

  async function refresh() {
    await Promise.all(
      [...slots, 'autosave' as const].map(async (slot) => {
        let text: string | null
        try {
          text = await readSlot(slot)
        } catch (error) {
          delete status.value[slot]
          message.value = { key: 'loadFailed', reason: errorMessage(error) }
          return
        }
        if (text === null) return void (status.value[slot] = 'empty')
        try {
          status.value[slot] = { day: clock(deserialize(text).time.hour).day }
        } catch {
          status.value[slot] = 'invalid'
        }
      }),
    )
  }

  async function save(slot: Slot) {
    message.value = null
    try {
      // serialize only reads the state, so the cast of the readonly snapshot is safe.
      await writeSlot(slot, serialize(game.state as GameState))
    } catch (error) {
      message.value = { key: 'saveFailed', reason: errorMessage(error) }
      return
    }
    await refresh()
  }

  async function load(slot: Slot) {
    message.value = null
    try {
      await loadSlot(slot)
    } catch (error) {
      message.value = { key: 'loadFailed', reason: errorMessage(error) }
    }
  }

  // The resume step at start loads the new world from the slot autosave.
  async function newGame() {
    message.value = null
    confirmNewGame.value = false
    // A pause stops the autosave, so no day change writes the old game after the new world.
    game.dispatch({ type: 'SetSpeed', speed: 0 })
    try {
      await writeSlot('autosave', serialize(createState(pickSeed(''))))
    } catch (error) {
      message.value = { key: 'saveFailed', reason: errorMessage(error) }
      return
    }
    // Without the query, a ?seed= link does not build its seed world again.
    location.replace(location.pathname)
  }

  return { open, status, message, confirmNewGame, refresh, save, load, newGame }
})
