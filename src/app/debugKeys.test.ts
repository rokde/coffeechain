import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installDebugKeys, isFpsKey } from './debugKeys'
import { useViewStore } from './view'

const press = { key: 'f', repeat: false, metaKey: false, ctrlKey: false, altKey: false }

describe('isFpsKey (S54)', () => {
  it('AC-5: f and F toggle the meter', () => {
    expect(isFpsKey(press, false)).toBe(true)
    expect(isFpsKey({ ...press, key: 'F' }, false)).toBe(true)
  })

  it('AC-5: ignores other keys, typing, repeat and modifier keys', () => {
    for (const key of ['h', 'g', 'w', '1', ' ', 'Escape'])
      expect(isFpsKey({ ...press, key }, false)).toBe(false)
    expect(isFpsKey(press, true)).toBe(false)
    for (const mod of ['repeat', 'metaKey', 'ctrlKey', 'altKey'])
      expect(isFpsKey({ ...press, [mod]: true }, false)).toBe(false)
  })
})

describe('installDebugKeys (S54)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('AC-5: a key press F flips fpsVisible', () => {
    let listener: (event: KeyboardEvent) => void = () => {}
    vi.stubGlobal('window', { addEventListener: (_: string, l: typeof listener) => (listener = l) })
    // isTyping checks for an HTMLElement target. Here the target is no element.
    vi.stubGlobal('HTMLElement', class {})
    setActivePinia(createPinia())
    const view = useViewStore()
    installDebugKeys(view)
    expect(view.fpsVisible).toBe(false)
    listener({ ...press, target: null } as unknown as KeyboardEvent)
    expect(view.fpsVisible).toBe(true)
    listener({ ...press, key: 'F', ctrlKey: true, target: null } as unknown as KeyboardEvent)
    expect(view.fpsVisible).toBe(true)
    listener({ ...press, key: 'F', target: null } as unknown as KeyboardEvent)
    expect(view.fpsVisible).toBe(false)
  })
})
