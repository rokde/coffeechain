import { invoke, isTauri } from '@tauri-apps/api/core'
import { deserialize } from '../sim/save/save'
import type { GameState } from '../sim/state'

// The same rule as valid_slot in src-tauri/src/lib.rs.
const SLOT = /^[a-z0-9-]{1,32}$/
const PENDING = 'coffeechain.pendingLoad'

function key(slot: string): string {
  if (!SLOT.test(slot)) throw new Error(`Invalid slot name: ${slot}`)
  return `coffeechain.save.${slot}`
}

export async function writeSlot(slot: string, text: string): Promise<void> {
  const k = key(slot)
  if (isTauri()) await invoke('save_write', { slot, text })
  else localStorage.setItem(k, text)
}

export async function readSlot(slot: string): Promise<string | null> {
  const k = key(slot)
  if (isTauri()) return invoke<string | null>('save_read', { slot })
  return localStorage.getItem(k)
}

// main.ts builds the scene once from the first world, so a reload starts the loaded world.
export async function loadSlot(slot: string): Promise<void> {
  const text = await readSlot(slot)
  if (text === null) throw new Error(`Slot ${slot} is empty`)
  deserialize(text)
  sessionStorage.setItem(PENDING, text)
  location.reload()
}

let pendingError: string | null = null

// The reason why the last pending load was invalid, or null.
export const pendingLoadError = () => pendingError

// The state from loadSlot before the reload, or null. Removes the key.
export function takePendingLoad(): GameState | null {
  pendingError = null
  const text = sessionStorage.getItem(PENDING)
  sessionStorage.removeItem(PENDING)
  if (text === null) return null
  try {
    return deserialize(text)
  } catch (error) {
    console.error('Pending load is invalid', error)
    pendingError = errorMessage(error)
    return null
  }
}

// Tauri invoke rejects with a plain string, not an Error.
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
