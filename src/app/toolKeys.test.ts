import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isBuildable } from '../sim/farm/parcels'
import type { GameState } from '../sim/state'
import { useSelectionStore } from './selection'
import { useGameStore } from './store'
import { installToolKeys, toolForKey } from './toolKeys'
import { useViewStore } from './view'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

const map = {
  v: 'select',
  p: 'parcel',
  l: 'plant',
  g: 'fertilize',
  r: 'irrigate',
  t: 'protect',
  n: 'harvest',
  b: 'build',
  m: 'market',
}
const other = ['w', 'a', 's', 'd', 'q', 'e', 'h', 'f', '0', '1', '5', ' ', 'Escape']

describe('toolForKey (S53)', () => {
  it('AC-1: each tool key gives its tool in lower and upper case', () => {
    for (const [key, id] of Object.entries(map)) {
      expect(toolForKey(key, false, false)).toBe(id)
      expect(toolForKey(key.toUpperCase(), false, false)).toBe(id)
    }
  })

  it('AC-1: other keys, typing and the open help give no tool', () => {
    for (const key of other) expect(toolForKey(key, false, false)).toBeUndefined()
    for (const key of [...Object.keys(map), ...other]) {
      expect(toolForKey(key, true, false)).toBeUndefined()
      expect(toolForKey(key, false, true)).toBeUndefined()
    }
  })
})

describe('installToolKeys (S53)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('location', { search: '?seed=42' })
    vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })
  })

  it('AC-2: a key press does the same as a toolbar click, and an input keeps the tool', () => {
    let listener: (event: KeyboardEvent) => void = () => {}
    vi.stubGlobal('window', { addEventListener: (_: string, l: typeof listener) => (listener = l) })
    class Element {
      constructor(private tag: string) {}
      isContentEditable = false
      matches = (selector: string) => selector.split(', ').includes(this.tag)
    }
    vi.stubGlobal('HTMLElement', Element)
    const pinia = createPinia()
    setActivePinia(pinia)
    const game = useGameStore(pinia)
    const selection = useSelectionStore(pinia)
    installToolKeys(useViewStore(pinia), selection, game)
    const state = game.state as GameState
    const free = state.world.parcels.find(
      (p) => p.zone === 'tiefland' && isBuildable(state.world, p.x, p.y),
    )!
    const mark = { x: free.x, y: free.y }
    selection.parcels = [mark]
    const press = (key: string, target: unknown = null) =>
      listener({ key, repeat: false, target } as unknown as KeyboardEvent)

    press('P')
    expect(selection.tool).toBe('parcel')
    expect(selection.parcels).toEqual([mark])
    press('N')
    expect(selection.tool).toBe('harvest')
    expect(selection.parcels).toEqual([])
    expect(selection.note).toBe('invalid')
    press('v', new Element('input'))
    expect(selection.tool).toBe('harvest')
    for (const mod of ['repeat', 'metaKey', 'ctrlKey', 'altKey'])
      listener({ key: 'v', target: null, [mod]: true } as unknown as KeyboardEvent)
    expect(selection.tool).toBe('harvest')
    press('v', new Element('div'))
    expect(selection.tool).toBe('select')
  })
})
