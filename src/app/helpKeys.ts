import { isBrushTool } from './selection'
import { isTyping } from './speedKeys'
import type { useViewStore } from './view'

// H toggles the help. Esc only closes it.
export function helpKeyAction(
  key: string,
  open: boolean,
  typing: boolean,
): 'open' | 'close' | undefined {
  if (typing) return undefined
  if (key === 'h' || key === 'H') return open ? 'close' : 'open'
  if (key === 'Escape' && open) return 'close'
  return undefined
}

// Esc puts down an armed tool, but only when the help is closed. With the help open, Esc only closes it.
export function disarmKey(key: string, helpOpen: boolean, typing: boolean): boolean {
  return key === 'Escape' && !helpOpen && !typing
}

export function installHelpKeys(
  view: ReturnType<typeof useViewStore>,
  selection: { tool: string; parcels: unknown[] },
) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
    const typing = isTyping(event.target)
    // Read helpOpen before the help closes, so that one Esc does not also put down the tool.
    if (disarmKey(event.key, view.helpOpen, typing)) {
      if (isBrushTool(selection.tool)) selection.tool = 'select'
      selection.parcels = []
    } else if (helpKeyAction(event.key, view.helpOpen, typing)) view.toggleHelp()
  })
}
