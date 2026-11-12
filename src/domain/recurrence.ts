import { addDays, addMonths } from './date'
import type { Recurrence } from './types'

const UNITS: Record<Recurrence['unit'], [string, string]> = {
  day: ['jour', 'jours'],
  week: ['semaine', 'semaines'],
  month: ['mois', 'mois'],
}

export function nextDate(day: string, r: Recurrence): string {
  const n = Math.max(1, r.interval)
  if (r.unit === 'month') return addMonths(day, n)
  return addDays(day, r.unit === 'week' ? 7 * n : n)
}

/** Fixed schedule: the next occurrences to create once the current one is due, up to the first one still ahead. */
export function fixedOccurrences(due: string, r: Recurrence, today: string, max = 12): string[] {
  const dates: string[] = []
  let current = due
  while (current <= today && dates.length < max) {
    current = nextDate(current, r)
    dates.push(current)
  }
  return dates
}

export function describeRecurrence(r: Recurrence): string {
  const [one, many] = UNITS[r.unit]
  const every = r.interval <= 1 ? `Chaque ${one}` : `Tous les ${r.interval} ${many}`
  return r.mode === 'fixed' ? `${every}, date fixe` : `${every} après réalisation`
}
