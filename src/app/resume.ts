import type { GameState } from '../sim/state'
import { loadAtStart, readSlot, takePendingLoad } from './saves'
import { seedParam } from './seed'

const SKIP = 'coffeechain.skipResume'

// state: the game to start or to offer, null for a new world. menu: show the start screen first. Never throws.
export async function startState(
  search: string,
): Promise<{ state: GameState | null; menu: boolean }> {
  const pending = takePendingLoad()
  if (pending) return { state: pending, menu: false }
  // A ?seed= link must give the same world each time (e2e tests, debug links).
  if (seedParam(search) !== null) return { state: null, menu: false }
  const menu = new URLSearchParams(search).get('debug') !== 'models'
  if (sessionStorage.getItem(SKIP) !== null) {
    sessionStorage.removeItem(SKIP)
    return { state: null, menu }
  }
  let text: string | null
  try {
    text = await readSlot('autosave')
  } catch (error) {
    console.error('Autosave is not readable, a new game starts', error)
    return { state: null, menu }
  }
  return { state: text === null ? null : loadAtStart(text, 'Autosave'), menu }
}

// Reloads into the start screen without the autosave offer, so the player selects a new seed.
// main.ts also calls it when the start with a loaded state fails, so the app does not stay blank.
export function skipResume() {
  sessionStorage.setItem(SKIP, '1')
  // Without the query, a ?seed= link does not skip the start screen.
  location.replace(location.pathname)
}
