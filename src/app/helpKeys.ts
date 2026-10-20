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

export function installHelpKeys(view: ReturnType<typeof useViewStore>) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
    if (helpKeyAction(event.key, view.helpOpen, isTyping(event.target))) view.toggleHelp()
  })
}
