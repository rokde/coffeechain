import { isTyping } from './speedKeys'
import type { useViewStore } from './view'

type Key = Pick<KeyboardEvent, 'key' | 'repeat' | 'metaKey' | 'ctrlKey' | 'altKey'>

// F toggles the fps meter.
export function isFpsKey(event: Key, typing: boolean): boolean {
  if (typing || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return false
  return event.key === 'f' || event.key === 'F'
}

export function installDebugKeys(view: ReturnType<typeof useViewStore>) {
  window.addEventListener('keydown', (event) => {
    if (isFpsKey(event, isTyping(event.target))) view.toggleFps()
  })
}
