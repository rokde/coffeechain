import { deserialize } from '../sim/save/save'
import type { GameState } from '../sim/state'
import { readSlot, takePendingLoad } from './saves'
import { seedParam } from './seed'

const SKIP = 'coffeechain.skipResume'

// The state for the start, or null for a new world. Never throws.
export async function startState(search: string): Promise<GameState | null> {
  const pending = takePendingLoad()
  if (pending) return pending
  // A ?seed= link must give the same world each time (e2e tests, debug links).
  if (seedParam(search) !== null) return null
  if (sessionStorage.getItem(SKIP) !== null) {
    sessionStorage.removeItem(SKIP)
    return null
  }
  try {
    const text = await readSlot('autosave')
    return text === null ? null : deserialize(text)
  } catch (error) {
    console.error('Autosave is not readable, a new game starts', error)
    return null
  }
}

// The start failed with a loaded state. The reload starts a new world, so the app does not stay blank.
export function skipResume() {
  sessionStorage.setItem(SKIP, '1')
  location.reload()
}
