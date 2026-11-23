// Keyboard of a tablist (WAI-ARIA tabs pattern). WebKit has no focusgroup, so the keys are our own.
// Returns the index of the tab to focus, or null for a key that the tablist does not handle.
export function tabKey(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count
    case 'ArrowLeft':
      return (index - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
