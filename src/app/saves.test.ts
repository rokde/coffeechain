import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { SAVE_VERSION, serialize } from '../sim/save/save'
import { createState } from '../sim/state'
import { loadSlot, readSlot, writeSlot } from './saves'
import { startState } from './resume'
import { setStartState, useGameStore } from './store'

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }))

function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    key: (i) => [...items.keys()][i] ?? null,
    getItem: vi.fn((k: string) => items.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void items.set(k, v)),
    removeItem: vi.fn((k: string) => void items.delete(k)),
    clear: () => items.clear(),
  }
}

const PENDING = 'coffeechain.pendingLoad'
let local: Storage
let session: Storage
let reload: ReturnType<typeof vi.fn>

beforeEach(() => {
  local = memoryStorage()
  session = memoryStorage()
  reload = vi.fn()
  vi.stubGlobal('localStorage', local)
  vi.stubGlobal('sessionStorage', session)
  vi.stubGlobal('location', { search: '?seed=42', reload })
  setActivePinia(createPinia())
  setStartState(null)
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(invoke).mockReset()
})

describe('save slots (S42)', () => {
  it('AC-2: reads back the written text, and null for an empty slot', async () => {
    await writeSlot('slot-1', 'text')
    expect(await readSlot('slot-1')).toBe('text')
    expect(local.getItem('coffeechain.save.slot-1')).toBe('text')
    expect(await readSlot('slot-2')).toBeNull()
  })

  it.each(['../x', 'a/b', '', 'Slot1', 'a'.repeat(33), 'slot-1\n'])(
    'AC-3: rejects the slot name %j without storage access',
    async (slot) => {
      await expect(writeSlot(slot, 'text')).rejects.toThrow(/slot name/)
      await expect(readSlot(slot)).rejects.toThrow(/slot name/)
      expect(local.setItem).not.toHaveBeenCalled()
      expect(local.getItem).not.toHaveBeenCalled()
    },
  )

  it('AC-3: accepts a 32-character name', async () => {
    await writeSlot('a'.repeat(32), 'text')
    expect(await readSlot('a'.repeat(32))).toBe('text')
  })

  it('uses the Tauri commands in the app', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockResolvedValue(null)
    await writeSlot('slot-1', 'text')
    expect(invoke).toHaveBeenCalledWith('save_write', { slot: 'slot-1', text: 'text' })
    expect(await readSlot('slot-1')).toBeNull()
    expect(invoke).toHaveBeenCalledWith('save_read', { slot: 'slot-1' })
    await expect(readSlot('../x')).rejects.toThrow(/slot name/)
    expect(invoke).toHaveBeenCalledTimes(2)
    expect(local.setItem).not.toHaveBeenCalled()
  })

  it('AC-4: does not load an invalid save', async () => {
    await writeSlot('slot-1', JSON.stringify({ version: SAVE_VERSION, state: { money: 'a lot' } }))
    await expect(loadSlot('slot-1')).rejects.toThrow(/money/)
    await expect(loadSlot('slot-2')).rejects.toThrow(/empty/)
    expect(session.setItem).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('AC-4: puts a valid save into sessionStorage and reloads', async () => {
    const text = serialize(createState(7))
    await writeSlot('slot-1', text)
    await loadSlot('slot-1')
    expect(session.getItem(PENDING)).toBe(text)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('AC-5: the store starts with the pending save and removes the key', async () => {
    const state = { ...createState(7), money: 12300 }
    session.setItem(PENDING, serialize(state))
    setStartState(await startState(location.search))
    const store = useGameStore()
    expect(store.state.world.seed).toBe(7)
    expect(store.state.money).toBe(12300)
    expect(session.getItem(PENDING)).toBeNull()
  })

  it('AC-5: the store ignores an invalid pending save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    session.setItem(PENDING, JSON.stringify({ version: SAVE_VERSION, state: { money: 1 } }))
    setStartState(await startState(location.search))
    const store = useGameStore()
    expect(store.state).toEqual(createState(42))
    expect(session.getItem(PENDING)).toBeNull()
  })
})

describe('write queue (S43)', () => {
  it('AC-2: a second write to a slot starts after the first ends, also after a reject', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    const calls: string[] = []
    const ends: Array<(fail: boolean) => void> = []
    vi.mocked(invoke).mockImplementation((_cmd, args) => {
      calls.push((args as { text: string }).text)
      return new Promise((resolve, reject) =>
        ends.push((fail) => (fail ? reject('disk full') : resolve(null))),
      )
    })
    const a = writeSlot('autosave', 'a')
    const b = writeSlot('autosave', 'b')
    const c = writeSlot('autosave', 'c')
    await vi.waitFor(() => expect(calls).toEqual(['a']))
    ends[0]!(true)
    await expect(a).rejects.toBe('disk full')
    await vi.waitFor(() => expect(calls).toEqual(['a', 'b']))
    ends[1]!(false)
    await b
    await vi.waitFor(() => expect(calls).toEqual(['a', 'b', 'c']))
    ends[2]!(false)
    await c
    expect(calls.at(-1)).toBe('c')
  })

  it('AC-2: the slot ends with the last write in localStorage', async () => {
    const a = writeSlot('autosave', 'a')
    const b = writeSlot('autosave', 'b')
    await Promise.all([a, b])
    expect(await readSlot('autosave')).toBe('b')
  })

  it('AC-2: writes to two slots do not wait for each other', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    const slots: string[] = []
    const ends: Array<() => void> = []
    vi.mocked(invoke).mockImplementation((_cmd, args) => {
      slots.push((args as { slot: string }).slot)
      return new Promise((resolve) => ends.push(() => resolve(null)))
    })
    const writes = [writeSlot('slot-1', 'a'), writeSlot('autosave', 'b')]
    await vi.waitFor(() => expect(slots).toEqual(['slot-1', 'autosave']))
    ends.forEach((end) => end())
    await Promise.all(writes)
  })
})
