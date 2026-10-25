import { calendar } from '../sim/time/time'
import de from './i18n/de.json'

// ["12. März", "Jahr 2"] for a calendar day since the start.
export function dateParts(day: number): [string, string] {
  const { dayOfMonth, month, year } = calendar(day)
  return [
    de.time.date
      .replace('{day}', String(dayOfMonth))
      .replace('{month}', de.time.months[month - 1]!),
    de.time.year.replace('{year}', String(year)),
  ]
}

// "12. März, Jahr 2"
export const formatDate = (day: number) => dateParts(day).join(de.time.separator)

// "Oktober" in the year of today, else "Oktober, Jahr 3".
export function formatMonth(day: number, today: number): string {
  const { month, year } = calendar(day)
  const name = de.time.months[month - 1]!
  return year === calendar(today).year
    ? name
    : [name, de.time.year.replace('{year}', String(year))].join(de.time.separator)
}
