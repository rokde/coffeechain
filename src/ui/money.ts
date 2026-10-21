import de from './i18n/de.json'

const whole = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })
const unit = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

// cents: hundredths of CC, as in the sim.
// Balances and totals show whole CC. The floor keeps the capital (stock value) from showing more than it is.
export const formatMoney = (cents: number) =>
  de.money.replace('{n}', whole.format(Math.floor(cents / 100)))

// A price per unit keeps up to 2 decimals.
export const formatUnitPrice = (cents: number) => de.money.replace('{n}', unit.format(cents / 100))
