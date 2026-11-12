/** Days are 'YYYY-MM-DD' strings, so they compare correctly as text. */

const pad = (n: number) => String(n).padStart(2, '0')

const parse = (day: string) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const format = (date: Date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`

/** The logical day of a local time: before the rollover hour, it is still yesterday. */
export function logicalDay(now: Date, rolloverHour: number): string {
  const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return now.getHours() < rolloverHour ? addDays(key, -1) : key
}

export function addDays(day: string, delta: number): string {
  const date = parse(day)
  date.setUTCDate(date.getUTCDate() + delta)
  return format(date)
}

/** 0 for Monday, 6 for Sunday. */
export function weekday(day: string): number {
  return (parse(day).getUTCDay() + 6) % 7
}

export function mondayOf(day: string): string {
  return addDays(day, -weekday(day))
}

export function formatLongDay(day: string): string {
  const text = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(parse(day))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatShortDay(day: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parse(day))
}

export function firstOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`
}

/** Same day N months later, clamped to the end of shorter months (31 Jan + 1 month = 28 Feb). */
export function addMonths(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + delta, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(d, lastDay))
  return format(first)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000)
}

export function formatMonth(day: string): string {
  const text = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parse(day))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** 'HH:MM' of a local time. */
export function clockTime(now: Date): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`
}
