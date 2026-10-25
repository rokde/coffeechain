import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { serialize } from '../sim/save/save'
import { createState } from '../sim/state'
import { skipResume, startState } from './resume'
import { pendingLoadError } from './saves'

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
    setItem: (k: string, v: string) => session.set(k, v),
    removeItem: (k: string) => session.delete(k),
  })
  vi.stubGlobal('location', { pathname: '/', reload: vi.fn(), replace: vi.fn() })
  vi.mocked(isTauri).mockReturnValue(false)
  vi.mocked(invoke).mockReset()
})

const saved = () => {
  const state = createState(7)
  return { ...state, time: { ...state.time, day: 24 * 3 + 5 }, money: 4300 }
}

describe('startState (S43b)', () => {
  it('AC-1: returns the autosave state without ?seed=', async () => {
    local.set(AUTOSAVE, serialize(saved()))
    const { state, menu } = await startState('')
    expect(state).toEqual(saved())
    expect(state?.world.seed).toBe(7)
    expect(menu).toBe(true)
  })

  it('AC-1: ignores other query parameters', async () => {
    local.set(AUTOSAVE, serialize(saved()))
    expect(await startState('?seed=x')).toEqual({ state: saved(), menu: true })
  })

  it('#3 AC-5: ?debug=models skips the start screen', async () => {
    local.set(AUTOSAVE, serialize(saved()))
    expect(await startState('?debug=models&seed=x')).toEqual({ state: saved(), menu: false })
  })

  it('AC-1: returns null for an empty slot', async () => {
    expect(await startState('')).toEqual({ state: null, menu: true })
  })

  it.each([['{broken'], [JSON.stringify({ version: 1, state: { money: 'a lot' } })]])(
    'AC-1: returns null and logs for the invalid text %j',
    async (text) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      local.set(AUTOSAVE, text)
      expect((await startState('')).state).toBeNull()
      expect(error).toHaveBeenCalled()
    },
  )

  it('AC-3 (#17): returns null for a version 10 autosave and keeps the reason', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    local.set(AUTOSAVE, JSON.stringify({ version: 10, state: saved() }))
    expect((await startState('')).state).toBeNull()
    expect(pendingLoadError()).toMatch(/unknown or old version/)
    local.set(AUTOSAVE, serialize(saved()))
    expect((await startState('')).state).toEqual(saved())
    expect(pendingLoadError()).toBeNull()
  })

  it('AC-1: returns null for a save whose parcel count does not match the size', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const state = saved()
    const world = { ...state.world, parcels: state.world.parcels.slice(0, 10) }
    local.set(AUTOSAVE, serialize({ ...state, world }))
    expect((await startState('')).state).toBeNull()
    expect(String(error.mock.calls[0]?.[1])).toMatch(/Parcel count does not match size/)
  })

  it.each([[[]], [[{ x: 1, y: 2 }]]])(
    'AC-1: returns null for a save with the path %j',
    async (path) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const state = saved()
      local.set(AUTOSAVE, serialize({ ...state, props: { ...state.props, path } }))
      expect((await startState('')).state).toBeNull()
      expect(String(error.mock.calls[0]?.[1])).toMatch(/path/)
    },
  )

  it('a failed start skips the autosave for the next start only', async () => {
    local.set(AUTOSAVE, serialize(saved()))
    skipResume()
    expect(location.replace).toHaveBeenCalledExactlyOnceWith('/')
    expect(await startState('')).toEqual({ state: null, menu: true })
    expect(getItem).not.toHaveBeenCalled()
    expect((await startState('')).state).toEqual(saved())
  })

  it('AC-1: returns null and logs when readSlot rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockRejectedValue('disk error')
    expect((await startState('')).state).toBeNull()
    expect(invoke).toHaveBeenCalledWith('save_read', { slot: 'autosave' })
    expect(error).toHaveBeenCalled()
  })

  it('AC-2: a pending load wins over the autosave', async () => {
    local.set(AUTOSAVE, serialize(saved()))
    const pending = { ...createState(9), money: 100 }
    session.set(PENDING, serialize(pending))
    expect(await startState('')).toEqual({ state: pending, menu: false })
    expect(session.has(PENDING)).toBe(false)
  })

  it('AC-2: with ?seed=7 it returns null and does not read the slot', async () => {
    local.set(AUTOSAVE, serialize(saved()))
    expect(await startState('?seed=7')).toEqual({ state: null, menu: false })
    expect(getItem).not.toHaveBeenCalled()
  })

  it('AC-2: an invalid pending load falls back to the autosave', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    local.set(AUTOSAVE, serialize(saved()))
    session.set(PENDING, '{broken')
    expect((await startState('')).state).toEqual(saved())
  })
})
