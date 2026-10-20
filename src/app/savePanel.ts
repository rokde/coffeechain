import { defineStore } from 'pinia'
import { ref } from 'vue'
import { deserialize, serialize } from '../sim/save/save'
import type { GameState } from '../sim/state'
import { clock } from '../sim/time/time'
import { errorMessage, loadSlot, pendingLoadError, readSlot, writeSlot } from './saves'
import { useGameStore } from './store'

export const slots = ['slot-1', 'slot-2', 'slot-3'] as const
export type Slot = (typeof slots)[number]
export type SlotStatus = { day: number } | 'empty' | 'invalid'
// key: the text key in de.json savePanel.
export type SaveMessage =
  { key: 'saveFailed' | 'loadFailed'; reason: string } | { key: 'invalidPending' }

export const useSavePanelStore = defineStore('savePanel', () => {
  // The game store reads the pending load, so it must exist before pendingLoadError is read.
  const game = useGameStore()
  const invalidPending = pendingLoadError() !== null
  const open = ref(invalidPending)
  const status = ref<Partial<Record<Slot, SlotStatus>>>({})
  const message = ref<SaveMessage | null>(invalidPending ? { key: 'invalidPending' } : null)

  async function refresh() {
    await Promise.all(
      slots.map(async (slot) => {
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

  return { open, status, message, refresh, save, load }
})
