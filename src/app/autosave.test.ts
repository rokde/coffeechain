import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { balance } from '../sim/balance'
import { deserialize } from '../sim/save/save'
import type { GameState } from '../sim/state'
import { clock } from '../sim/time/time'
import { installAutosave } from './autosave'
import { writeSlot } from './saves'
import { useGameStore } from './store'

vi.mock('./saves', () => ({ writeSlot: vi.fn(), takePendingLoad: () => null }))

beforeEach(() => {
  vi.stubGlobal('location', { search: '?seed=42' })
  setActivePinia(createPinia())
  vi.mocked(writeSlot).mockReset().mockResolvedValue()
})

async function setHour(store: ReturnType<typeof useGameStore>, hour: number) {
  const state = store.state as GameState
  store.replace({ ...state, time: { ...state.time, hour } })
  await nextTick()
}

describe('installAutosave (S43)', () => {
  it('AC-1: writes the slot autosave once at a new game day, not at start or inside a day', async () => {
    const day = balance().time.ticksPerGameDay
    const store = useGameStore()
    installAutosave(store)
    await nextTick()
    expect(writeSlot).not.toHaveBeenCalled()

    await setHour(store, 3)
    await setHour(store, day - 1)
    expect(writeSlot).not.toHaveBeenCalled()

    await setHour(store, day)
    expect(writeSlot).toHaveBeenCalledOnce()
    const [slot, text] = vi.mocked(writeSlot).mock.calls[0]!
    expect(slot).toBe('autosave')
    expect(clock(deserialize(text).time.hour).day).toBe(2)

    await setHour(store, day + 1)
    expect(writeSlot).toHaveBeenCalledOnce()
  })

  it('logs a failed write and continues', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(writeSlot).mockRejectedValue('disk full')
    const store = useGameStore()
    installAutosave(store)
    await setHour(store, balance().time.ticksPerGameDay)
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith('Autosave failed', 'disk full'))
  })
})
