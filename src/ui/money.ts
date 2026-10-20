import de from './i18n/de.json'

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

// cents: hundredths of CC, as in the sim.
export const formatMoney = (cents: number) => de.money.replace('{n}', number.format(cents / 100))
