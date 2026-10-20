import { describe, expect, it } from 'vitest'
import { disarmKey, helpKeyAction } from './helpKeys'

describe('helpKeyAction (S35a)', () => {
  it('AC-1: h and H open, h, H and Escape close', () => {
    expect(helpKeyAction('h', false, false)).toBe('open')
    expect(helpKeyAction('H', false, false)).toBe('open')
    for (const key of ['h', 'H', 'Escape']) expect(helpKeyAction(key, true, false)).toBe('close')
  })

  it('AC-1: ignores Escape when closed, other keys and typing', () => {
    expect(helpKeyAction('Escape', false, false)).toBeUndefined()
    for (const key of ['q', 'e', 'w', '0', '1', ' '])
      for (const open of [false, true]) expect(helpKeyAction(key, open, false)).toBeUndefined()
    for (const key of ['h', 'H', 'Escape'])
      for (const open of [false, true]) expect(helpKeyAction(key, open, true)).toBeUndefined()
  })
})

describe('disarmKey (S40)', () => {
  it('AC-4: Escape puts down the tool only when the help is closed and the player does not type', () => {
    expect(disarmKey('Escape', false, false)).toBe(true)
    expect(disarmKey('Escape', true, false)).toBe(false)
    expect(helpKeyAction('Escape', true, false)).toBe('close')
    expect(disarmKey('Escape', false, true)).toBe(false)
    for (const key of ['h', 'q', ' ', '1']) expect(disarmKey(key, false, false)).toBe(false)
  })
})
