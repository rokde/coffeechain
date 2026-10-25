import type { GameState } from '../sim/state'
import { loadAtStart, readSlot, takePendingLoad } from './saves'
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
  let text: string | null
  try {
    text = await readSlot('autosave')
  } catch (error) {
    console.error('Autosave is not readable, a new game starts', error)
    return null
  }
  return text === null ? null : loadAtStart(text, 'Autosave')
}

// The start failed with a loaded state. The reload starts a new world, so the app does not stay blank.
export function skipResume() {
  sessionStorage.setItem(SKIP, '1')
  location.reload()
}
