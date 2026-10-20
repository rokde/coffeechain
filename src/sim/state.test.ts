import { describe, expect, it } from 'vitest'
import { balance } from './balance'
import { createState } from './state'
import { generateWorld } from './world/generate'

describe('createState', () => {
  it('fills the world from the seed', () => {
    expect(createState(42).world).toEqual(generateWorld(42, balance()))
  })

  it('gives equal states for the same seed', () => {
    expect(createState(42)).toEqual(createState(42))
  })
})
