import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readSave } from '../sim/save/save'
import type { GameState } from '../sim/state'
import { slots, type Slot } from './savePanel'
import { readSlot } from './saves'

export const listSlots: Slot[] = ['autosave', ...slots]
export type SaveEntry = { state: GameState; savedAt: number | null } | 'empty' | 'invalid'

// The saves that the start screen lists. main.ts calls refresh before the first frame.
export const useSaveListStore = defineStore('saveList', () => {
  const entries = ref<Partial<Record<Slot, SaveEntry>>>({})

  async function refresh() {
    await Promise.all(
      listSlots.map(async (slot) => {
        let text: string | null
        try {
          text = await readSlot(slot)
        } catch (error) {
          console.error(`Save ${slot} is not readable`, error)
          return void (entries.value[slot] = 'invalid')
        }
        try {
          entries.value[slot] = text === null ? 'empty' : readSave(text)
        } catch {
          entries.value[slot] = 'invalid'
        }
      }),
    )
  }

  return { entries, refresh }
})
