import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { serialize } from '../sim/save/save'
import { createState } from '../sim/state'
import { startState } from './resume'

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }))

const PENDING = 'coffeechain.pendingLoad'
const AUTOSAVE = 'coffeechain.save.autosave'
let local: Map<string, string>
let session: Map<string, string>
let getItem: ReturnType<typeof vi.fn>

beforeEach(() => {
  local = new Map()
  session = new Map()
  getItem = vi.fn((k: string) => local.get(k) ?? null)
  vi.stubGlobal('localStorage', { getItem, setItem: (k: string, v: string) => local.set(k, v) })
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => session.get(k) ?? null,
    removeItem: (k: string) => session.delete(k),
  })
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(invoke).mockReset()
})

const saved = () => {
  const state = createState(7)
  return { ...state, time: { ...state.time, hour: 24 * 3 + 5 }, money: 4321 }
}

describe('startState (S43b)', () => {
  it('AC-1: returns the autosave state without ?seed=', async () => {
    local.set(AUTOSAVE, serialize(saved()))
    const state = await startState('')
    expect(state).toEqual(saved())
    expect(state?.world.seed).toBe(7)
  })

  it('AC-1: ignores other query parameters', async () => {
    local.set(AUTOSAVE, serialize(saved()))
    expect(await startState('?debug=models&seed=x')).toEqual(saved())
  })

  it('AC-1: returns null for an empty slot', async () => {
    expect(await startState('')).toBeNull()
  })

  it.each([['{broken'], [JSON.stringify({ version: 1, state: { money: 'a lot' } })]])(
    'AC-1: returns null and logs for the invalid text %j',
    async (text) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      local.set(AUTOSAVE, text)
      await expect(startState('')).resolves.toBeNull()
      expect(error).toHaveBeenCalled()
    },
  )

  it('AC-1: returns null and logs when readSlot rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockRejectedValue('disk error')
    await expect(startState('')).resolves.toBeNull()
    expect(invoke).toHaveBeenCalledWith('save_read', { slot: 'autosave' })
    expect(error).toHaveBeenCalled()
  })

  it('AC-2: a pending load wins over the autosave', async () => {
    local.set(AUTOSAVE, serialize(saved()))
    const pending = { ...createState(9), money: 1 }
    session.set(PENDING, serialize(pending))
    expect(await startState('')).toEqual(pending)
    expect(session.has(PENDING)).toBe(false)
  })

  it('AC-2: with ?seed=7 it returns null and does not read the slot', async () => {
    local.set(AUTOSAVE, serialize(saved()))
    expect(await startState('?seed=7')).toBeNull()
    expect(getItem).not.toHaveBeenCalled()
  })

  it('AC-2: an invalid pending load falls back to the autosave', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    local.set(AUTOSAVE, serialize(saved()))
    session.set(PENDING, '{broken')
    expect(await startState('')).toEqual(saved())
  })
})
