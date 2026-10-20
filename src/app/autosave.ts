import { watch } from 'vue'
import { serialize } from '../sim/save/save'
import type { GameState } from '../sim/state'
import { clock } from '../sim/time/time'
import { writeSlot } from './saves'
import type { useGameStore } from './store'

// Writes the slot autosave at each new game day, so the player loses at most one day.
export function installAutosave(store: ReturnType<typeof useGameStore>) {
  let lastDay = clock(store.state.time.hour).day
  watch(
    () => clock(store.state.time.hour).day,
    (day) => {
      // A load can set an earlier day. The next write then comes one day after it.
      const newDay = day > lastDay
      lastDay = day
      if (!newDay) return
      // serialize only reads the state, so the cast of the readonly snapshot is safe.
      writeSlot('autosave', serialize(store.state as GameState)).catch((error: unknown) =>
        console.error('Autosave failed', error),
      )
    },
  )
}
