import { describe, expect, it } from 'vitest'
import { formatDate, formatMonth } from './date'

describe('date format (087)', () => {
  it('AC-1: formatMonth adds the year only for a different year', () => {
    expect(formatMonth(290, 0)).toBe('Oktober')
    expect(formatMonth(650, 300)).toBe('Oktober, Jahr 2')
    expect(formatMonth(359, 0)).toBe('Dezember')
    expect(formatMonth(360, 359)).toBe('Januar, Jahr 2')
  })

  it('AC-2: formatDate gives day, month and year', () => {
    expect(formatDate(431)).toBe('12. März, Jahr 2')
  })
})
