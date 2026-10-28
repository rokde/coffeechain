import { describe, expect, it } from 'vitest'
import { ago } from './ago'

const now = 1_700_000_000_000

describe('ago (#3)', () => {
  it.each([
    [now - 30_000, 'gerade eben'],
    [now + 60_000, 'gerade eben'],
    [now - 3 * 60_000, 'vor 3 Minuten'],
    [now - 2 * 3_600_000, 'vor 2 Stunden'],
    [now - 5 * 86_400_000, 'vor 5 Tagen'],
  ])('AC-3: %d gives %s', (savedAt, text) => {
    expect(ago(savedAt, now)).toBe(text)
  })
})
