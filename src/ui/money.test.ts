import { describe, expect, it } from 'vitest'
import { formatMoney, formatUnitPrice } from './money'

describe('money format (S57)', () => {
  it('AC-5: formatMoney shows whole CC, rounded down', () => {
    expect(formatMoney(12300)).toBe('123 CC')
    expect(formatMoney(12399)).toBe('123 CC')
    expect(formatMoney(123400)).toBe('1.234 CC')
  })

  it('AC-5: formatUnitPrice keeps up to 2 decimals', () => {
    expect(formatUnitPrice(40)).toBe('0,4 CC')
    expect(formatUnitPrice(59)).toBe('0,59 CC')
  })
})
