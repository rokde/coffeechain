import type { World } from './types'

// FNV-1a (32 bit) over the JSON text of the world.
export function hashWorld(world: World): string {
  const text = JSON.stringify(world)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
