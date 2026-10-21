import { createPinia, setActivePinia } from 'pinia'
import { expect, it } from 'vitest'
import { fieldAnchors } from '../render/fields'
import { createState, type GameState } from '../sim/state'
import { focusField } from './fieldFocus'
import { useSelectionStore } from './selection'
import { useViewStore } from './view'

it('AC-3: a field click selects and marks the field and asks for a new camera focus', () => {
  setActivePinia(createPinia())
  const selection = useSelectionStore()
  const view = useViewStore()
  const base = createState(1)
  const size = base.world.size
  // Field B owns three parcels, the lowest index is (4,2).
  const state: GameState = {
    ...base,
    farm: {
      ...base.farm,
      parcels: { [3 * size + 5]: 1, [2 * size + 4]: 1, [2 * size + 5]: 1, 0: 0 },
      fields: [
        { id: 0, name: 'A' },
        { id: 1, name: 'B' },
      ],
    },
  }
  selection.tool = 'fertilize'
  focusField(state, 1, selection, view)
  expect(selection.tool).toBe('select')
  expect(selection.parcel).toEqual({ x: 4, y: 2 })
  expect(selection.parcels).toEqual([
    { x: 4, y: 2 },
    { x: 5, y: 2 },
    { x: 5, y: 3 },
  ])
  const anchor = fieldAnchors(state.world, state.farm).find((a) => a.id === 1)!.position
  expect(view.focus).toEqual(anchor)
  const first = view.focus
  focusField(state, 1, selection, view)
  expect(view.focus).toEqual(first)
  expect(view.focus).not.toBe(first)
})
