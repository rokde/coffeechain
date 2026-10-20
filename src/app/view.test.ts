import { createPinia, setActivePinia } from 'pinia'
import { expect, it } from 'vitest'
import { useViewStore } from './view'

it('starts with no overlay and keeps only one overlay on', () => {
  setActivePinia(createPinia())
  const view = useViewStore()
  expect(view.overlay).toBe('none')
  view.toggle('soil')
  expect(view.overlay).toBe('soil')
  view.toggle('zone')
  expect(view.overlay).toBe('zone')
  view.toggle('zone')
  expect(view.overlay).toBe('none')
})

it('AC-2: the help starts closed and toggles', () => {
  setActivePinia(createPinia())
  const view = useViewStore()
  expect(view.helpOpen).toBe(false)
  view.toggleHelp()
  expect(view.helpOpen).toBe(true)
  view.toggleHelp()
  expect(view.helpOpen).toBe(false)
})
