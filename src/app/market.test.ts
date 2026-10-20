import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createState } from '../sim/state'
import { isMarketStand, selectParcel } from './market'
import { useSelectionStore } from './selection'

const state = createState(42)
const { hut, market } = state.props

describe('isMarketStand (S20)', () => {
  it('AC-2: is true for the market parcel', () => {
    expect(isMarketStand(state, state.props.market)).toBe(true)
  })

  it('AC-2: is false for the hut, for null and for a parcel next to the market', () => {
    expect(isMarketStand(state, hut)).toBe(false)
    expect(isMarketStand(state, null)).toBe(false)
    expect(isMarketStand(state, { x: market.x + 1, y: market.y })).toBe(false)
    expect(isMarketStand(state, { x: market.x, y: market.y - 1 })).toBe(false)
  })

  it('AC-2: a select click on the market parcel opens the market and clears the selection', () => {
    const selection = useSelectionStore(createPinia())
    selection.parcel = { x: hut.x, y: hut.y }
    selectParcel(selection, state, { x: market.x, y: market.y })
    expect(selection.tool).toBe('market')
    expect(selection.parcel).toBeNull()
  })

  it('AC-2: a select click on another parcel selects it and keeps the tool', () => {
    const selection = useSelectionStore(createPinia())
    selectParcel(selection, state, { x: hut.x, y: hut.y })
    expect(selection.tool).toBe('select')
    expect(selection.parcel).toEqual({ x: hut.x, y: hut.y })
  })
})
