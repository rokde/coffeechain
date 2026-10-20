import type { GameState } from '../sim/state'
import { tools } from '../ui/toolbar'
import { pickTool, type useSelectionStore } from './selection'
import { isTyping } from './speedKeys'
import type { useGameStore } from './store'
import type { useViewStore } from './view'

// The id of the tool that the letter key picks, in lower or upper case.
export function toolForKey(key: string, typing: boolean, helpOpen: boolean): string | undefined {
  if (typing || helpOpen) return undefined
  return tools.find((tool) => tool.key === key.toUpperCase())?.id
}

export function installToolKeys(
  view: ReturnType<typeof useViewStore>,
  selection: ReturnType<typeof useSelectionStore>,
  store: ReturnType<typeof useGameStore>,
) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
    const id = toolForKey(event.key, isTyping(event.target), view.helpOpen)
    if (id) pickTool(selection, store.state as GameState, id)
  })
}
