import { watch } from 'vue'
import { serialize } from '../sim/save/save'
import type { GameState } from '../sim/state'
import { monthIndex } from '../sim/time/time'
import { writeSlot } from './saves'
import type { useGameStore } from './store'

// Writes the slot autosave at each new month, so the player loses at most one month.
export function installAutosave(store: ReturnType<typeof useGameStore>) {
  let lastMonth = monthIndex(store.state.time.day)
  watch(
    () => monthIndex(store.state.time.day),
    (month) => {
      // A load can set an earlier month. The next write then comes one month after it.
      const newMonth = month > lastMonth
      lastMonth = month
      if (!newMonth) return
      // serialize only reads the state, so the cast of the readonly snapshot is safe.
      writeSlot('autosave', serialize(store.state as GameState)).catch((error: unknown) =>
        console.error('Autosave failed', error),
      )
    },
  )
}
