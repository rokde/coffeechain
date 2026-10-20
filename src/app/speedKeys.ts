import { watch } from 'vue'
import { balance } from '../sim/balance'
import type { useGameStore } from './store'

// Key 0 pauses, key n picks the n-th running speed, Space toggles the pause.
export function speedForKey(
  key: string,
  current: number,
  lastRunning: number | undefined,
  speeds: readonly number[],
): number | undefined {
  if (key === ' ') return current > 0 ? 0 : (lastRunning ?? 1)
  if (key === '0') return 0
  if (!/^[1-9]$/.test(key)) return undefined
  return speeds.filter((speed) => speed > 0)[Number(key) - 1]
}

export function installSpeedKeys(store: ReturnType<typeof useGameStore>) {
  let lastRunning: number | undefined
  watch(
    () => store.state.time.speed,
    (speed) => {
      if (speed > 0) lastRunning = speed
    },
    { immediate: true },
  )
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
    const target = event.target
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || target.matches('input, textarea, select'))
    )
      return
    const speed = speedForKey(event.key, store.state.time.speed, lastRunning, balance().time.speeds)
    if (speed === undefined) return
    // Stops the click that Space gives on a focused button.
    if (event.key === ' ') event.preventDefault()
    store.dispatch({ type: 'SetSpeed', speed })
  })
}
