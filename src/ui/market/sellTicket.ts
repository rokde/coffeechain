import type { Variety } from '../../sim/farm/yield'
import { bankBuyPrice, bankPriceAfterSale, saleBatches, sellIncome } from '../../sim/market/market'
import type { GameState } from '../../sim/state'
import de from '../i18n/de.json'

// The amount buttons of the ticket, as a share of the sellable stock. 1 is "Alles".
export const PRESETS = [0.25, 0.5, 1] as const

// A typed or dragged amount as a whole number from 0 to max. Anything else is 0.
export function clampAmount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, Math.round(value)))
}

export const presetAmount = (max: number, share: number) => Math.round(max * share)

export interface SellPreview {
  units: number
  // Hundredths of CC, the same value that the Sell command books.
  income: number
  // CC per unit: the mean price of the sale, today's price at 0 units.
  average: number
  // CC per unit right after the sale, and its change against today as a fraction.
  after: number
  change: number
  // Sellable units that stay in storage.
  rest: number
  // Units per batch, oldest first, with neighbours of the same quality merged.
  batches: { quality: number; units: number }[]
}

// Preview of a bank sale of units out of max sellable units. It uses the functions of the sale.
export function sellPreview(
  state: GameState,
  variety: Variety,
  washed: boolean,
  units: number,
  max: number,
): SellPreview {
  const today = bankBuyPrice(state, variety, 0, washed)
  const after = bankPriceAfterSale(state, variety, units, washed)
  const batches: SellPreview['batches'] = []
  const command = {
    type: 'Sell',
    variety,
    units,
    ...(washed && { washed: true as const }),
  } as const
  for (const b of saleBatches(state, command)) {
    const last = batches.at(-1)
    if (last?.quality === b.quality) last.units += b.units
    else batches.push({ quality: b.quality, units: b.units })
  }
  return {
    units,
    income: units > 0 ? sellIncome(state, variety, units, washed) : 0,
    average: bankBuyPrice(state, variety, units, washed),
    after,
    change: today > 0 ? after / today - 1 : 0,
    rest: max - units,
    batches,
  }
}

// Change of the last month against the month before, as a fraction.
export function trend(history: number[]): number {
  const [prev, now] = history.slice(-2)
  return prev && now !== undefined ? now / prev - 1 : 0
}

const fixed = (digits: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const two = fixed(2)
const three = fixed(3)
const one = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

// "0,38 CC" in lists and the chart, "0,380 CC" in the ticket.
export const formatPrice = (cc: number, digits: 2 | 3 = 2) =>
  de.money.replace('{n}', (digits === 3 ? three : two).format(cc))

// A change below half a tenth of a percent counts as flat.
export const direction = (change: number): 'up' | 'down' | 'flat' =>
  change > 0.0005 ? 'up' : change < -0.0005 ? 'down' : 'flat'

// "▲ +3,4 %", "▼ −2,2 %", "▶ ±0 %".
export function formatChange(change: number): string {
  const d = direction(change)
  const sign = d === 'up' ? '+' : d === 'down' ? '−' : '±'
  const arrow = d === 'up' ? '▲' : d === 'down' ? '▼' : '▶'
  const value = d === 'flat' ? '0' : one.format(Math.abs(change) * 100)
  return `${arrow} ${sign}${value}\u00a0%`
}
