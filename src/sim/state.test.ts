import { describe, expect, it } from 'vitest'
import { balance } from './balance'
import { createState } from './state'
import { generateWorld } from './world/generate'
import { placeProps } from './world/props'

describe('createState', () => {
  it('fills the world from the seed', () => {
    expect(createState(42).world).toEqual(generateWorld(42, balance()))
  })

  it('AC-1: fills the props from the world of the seed', () => {
    expect(createState(42).props).toEqual(placeProps(generateWorld(42, balance()), balance()))
  })

  it('AC-1: gives equal states for the same seed', () => {
    expect(createState(42)).toEqual(createState(42))
  })
})
