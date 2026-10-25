import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { deserialize, readSave, serialize } from '../sim/save/save'
import { createState } from '../sim/state'
import { useStartScreenStore } from './startScreen'

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }))

const AUTOSAVE = 'coffeechain.save.autosave'
let local: Map<string, string>

beforeEach(() => {
  local = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => local.get(k) ?? null,
    setItem: (k: string, v: string) => void local.set(k, v),
  })
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(invoke).mockReset()
  setActivePinia(createPinia())
})

const saved = () => {
  const state = createState(7)
  return { ...state, time: { ...state.time, day: 70 }, money: 124000 }
}

describe('start screen store (#3)', () => {
  it('AC-1: without a save it starts with a random valid seed and its preview', () => {
    const screen = useStartScreenStore()
    expect(screen.welcome).toBe(false)
    expect(screen.seed).not.toBeNull()
    expect(screen.preview?.world).toEqual(createState(screen.seed!).world)
  })

  it('AC-2: a typed seed gives the preview and the game of that world', async () => {
    const screen = useStartScreenStore()
    screen.seedText = '48213'
    expect(screen.preview?.world).toEqual(createState(48213).world)
    const state = await screen.play()
    expect(state?.world).toEqual(createState(48213).world)
    expect(state?.world.seed).toBe(48213)
    expect(state?.time.day).toBe(0)
  })

  it('AC-2: the reroll gives a new valid seed and its preview', () => {
    const screen = useStartScreenStore()
    const seeds = new Set<number>()
    for (let i = 0; i < 5; i++) {
      screen.reroll()
      expect(screen.seed).not.toBeNull()
      expect(screen.preview?.world.seed).toBe(screen.seed)
      seeds.add(screen.seed!)
    }
    expect(seeds.size).toBeGreaterThan(1)
  })

  it.each(['', '-1', '4294967296', '1.5', 'abc', '../x'])(
    'an invalid seed %j gives no preview and no game',
    async (text) => {
      const screen = useStartScreenStore()
      screen.seedText = text
      expect(screen.seed).toBeNull()
      expect(screen.preview).toBeNull()
      expect(await screen.play()).toBeNull()
      expect(local.size).toBe(0)
    },
  )

  it.each(['{broken', JSON.stringify({ version: 999 })])(
    'AC-2: a first start keeps an unreadable autosave %j',
    async (text) => {
      local.set(AUTOSAVE, text)
      const screen = useStartScreenStore()
      screen.seedText = '48213'
      expect((await screen.play())?.world.seed).toBe(48213)
      expect(local.get(AUTOSAVE)).toBe(text)
    },
  )

  it('a second play call gives no second game', async () => {
    const screen = useStartScreenStore()
    screen.save = saved()
    screen.newGame = true
    screen.seedText = '48213'
    const [first, second] = await Promise.all([screen.play(), screen.play()])
    expect(first?.world.seed).toBe(48213)
    expect(second).toBeNull()
    expect(await screen.play()).toBeNull()
  })

  it('AC-4: a failed autosave write still starts the game', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockRejectedValue('disk full')
    const screen = useStartScreenStore()
    screen.save = saved()
    screen.newGame = true
    screen.seedText = '48213'
    expect((await screen.play())?.world.seed).toBe(48213)
    expect(error).toHaveBeenCalled()
  })

  it('AC-3: with a save it offers the save, and the play gives the save unchanged', async () => {
    const screen = useStartScreenStore()
    const save = deserialize(serialize(saved(), 0))
    screen.save = save
    expect(screen.welcome).toBe(true)
    expect(screen.preview).toBe(save)
    expect(await screen.play()).toEqual(saved())
    expect(local.size).toBe(0)
  })

  it('AC-4: a confirmed new game shows the seed world and then replaces the autosave', async () => {
    local.set(AUTOSAVE, serialize(saved(), 0))
    const screen = useStartScreenStore()
    screen.save = saved()
    screen.confirmNewGame = true
    // Cancel keeps the save offer and the autosave.
    screen.confirmNewGame = false
    expect(screen.welcome).toBe(true)
    expect(deserialize(local.get(AUTOSAVE)!)).toEqual(saved())
    screen.newGame = true
    expect(screen.welcome).toBe(false)
    screen.seedText = '48213'
    expect(screen.preview?.world).toEqual(createState(48213).world)
    const state = await screen.play()
    expect(state?.world.seed).toBe(48213)
    expect(deserialize(local.get(AUTOSAVE)!).world.seed).toBe(48213)
  })

  it('#3 AC-2: a new game over the autosave writes savedAt from the clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: 1_700_000_000_000 })
    const screen = useStartScreenStore()
    screen.save = saved()
    screen.newGame = true
    screen.seedText = '48213'
    await screen.play()
    vi.useRealTimers()
    expect(readSave(local.get(AUTOSAVE)!).savedAt).toBe(1_700_000_000_000)
  })

  it('#3 AC-5: play with a chosen save gives that save once and writes nothing', async () => {
    const screen = useStartScreenStore()
    const chosen = createState(9)
    const [first, second] = await Promise.all([screen.play(chosen), screen.play(chosen)])
    expect(first).toBe(chosen)
    expect(second).toBeNull()
    expect(local.size).toBe(0)
  })
})
