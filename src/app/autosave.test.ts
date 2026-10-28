import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { balance } from '../sim/balance'
import { deserialize, readSave } from '../sim/save/save'
import type { GameState } from '../sim/state'
import { calendar } from '../sim/time/time'
import { installAutosave } from './autosave'
import { writeSlot } from './saves'
import { useGameStore } from './store'

vi.mock('./saves', () => ({ writeSlot: vi.fn(), takePendingLoad: () => null }))

beforeEach(() => {
  vi.stubGlobal('location', { search: '?seed=42' })
  setActivePinia(createPinia())
  vi.mocked(writeSlot).mockReset().mockResolvedValue()
})

async function setDay(store: ReturnType<typeof useGameStore>, day: number) {
  const state = store.state as GameState
  store.replace({ ...state, time: { ...state.time, day } })
  await nextTick()
}

const month = () => balance().time.daysPerMonth

describe('installAutosave (S43, #27)', () => {
  it('AC-6: writes the slot autosave once at the month change, not on the other 29 days', async () => {
    const store = useGameStore()
    installAutosave(store)
    await nextTick()
    for (let day = 1; day < month(); day++) await setDay(store, day)
    expect(writeSlot).not.toHaveBeenCalled()

    await setDay(store, month())
    expect(writeSlot).toHaveBeenCalledOnce()
    const [slot, text] = vi.mocked(writeSlot).mock.calls[0]!
    expect(slot).toBe('autosave')
    expect(calendar(deserialize(text).time.day)).toEqual({ dayOfMonth: 1, month: 2, year: 1 })

    for (let day = month() + 1; day < 2 * month(); day++) await setDay(store, day)
    expect(writeSlot).toHaveBeenCalledOnce()
  })

  it('AC-6: after a load of an earlier month, writes once at the next month', async () => {
    const store = useGameStore()
    installAutosave(store)
    await setDay(store, month() * 9)
    vi.mocked(writeSlot).mockClear()

    await setDay(store, month() * 2 + 5)
    expect(writeSlot).not.toHaveBeenCalled()
    await setDay(store, month() * 3)
    expect(writeSlot).toHaveBeenCalledOnce()
    expect(calendar(deserialize(vi.mocked(writeSlot).mock.calls[0]![1]).time.day).month).toBe(4)
  })

  it('#3 AC-2: the autosave writes savedAt from the clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: 1_700_000_000_000 })
    const store = useGameStore()
    installAutosave(store)
    await setDay(store, month())
    vi.useRealTimers()
    expect(readSave(vi.mocked(writeSlot).mock.calls[0]![1]).savedAt).toBe(1_700_000_000_000)
  })

  it('logs a failed write and continues', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(writeSlot).mockRejectedValue('disk full')
    const store = useGameStore()
    installAutosave(store)
    await setDay(store, month())
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith('Autosave failed', 'disk full'))
  })
})
