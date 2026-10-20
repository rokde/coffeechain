import { deserialize } from '../sim/save/save'
import type { GameState } from '../sim/state'
import { readSlot, takePendingLoad } from './saves'
import { seedParam } from './seed'

// The state for the start, or null for a new world. Never throws.
export async function startState(search: string): Promise<GameState | null> {
  const pending = takePendingLoad()
  if (pending) return pending
  // A ?seed= link must give the same world each time (e2e tests, debug links).
  if (seedParam(search) !== null) return null
  try {
    const text = await readSlot('autosave')
    return text === null ? null : deserialize(text)
  } catch (error) {
    console.error('Autosave is not readable, a new game starts', error)
    return null
  }
}
