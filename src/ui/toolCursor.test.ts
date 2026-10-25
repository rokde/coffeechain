import { describe, expect, it } from 'vitest'
import { toolCursor } from './toolCursor'

describe('toolCursor (S40)', () => {
  it('gives an SVG cursor with crosshair fallback per brush tool, and the default cursor else', () => {
    const brush = ['parcel', 'plant', 'fertilize', 'irrigate', 'harvest']
    const cursors = brush.map(toolCursor)
    for (const cursor of cursors)
      expect(cursor).toMatch(/^url\("data:image\/svg\+xml,.+"\) 5 5, crosshair$/)
    expect(new Set(cursors).size).toBe(brush.length)
    for (const tool of ['select', 'market']) expect(toolCursor(tool)).toBe('')
  })
})
