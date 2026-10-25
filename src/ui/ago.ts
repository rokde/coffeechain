import de from './i18n/de.json'

const relative = new Intl.RelativeTimeFormat('de', { numeric: 'always' })
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// "vor 3 Minuten" for epoch milliseconds before now. A time in the future gives "gerade eben".
export function ago(savedAt: number, now: number): string {
  const ms = now - savedAt
  if (ms < MINUTE) return de.startScreen.justNow
  if (ms < HOUR) return relative.format(-Math.floor(ms / MINUTE), 'minute')
  if (ms < DAY) return relative.format(-Math.floor(ms / HOUR), 'hour')
  return relative.format(-Math.floor(ms / DAY), 'day')
}
