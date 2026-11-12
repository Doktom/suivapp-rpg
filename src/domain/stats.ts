/** General statistics and heatmaps, as pure functions. */
import { addDays, mondayOf, weekday } from './date'
import { dayScore } from './fun'
import type { ValidationIndex } from './schedule'
import type { Habit } from './types'

export interface HeatCell {
  day: string
  /** 0..1, or null when nothing was due / it is in the future. */
  value: number | null
}

/** Weeks as columns (Monday first), ending with the week of `today`. */
export function heatmapWeeks(today: string, weeks: number, valueOf: (day: string) => number | null): HeatCell[][] {
  const start = addDays(mondayOf(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(start, w * 7 + d)
      return { day, value: day > today ? null : valueOf(day) }
    }),
  )
}

/** Share of habits done on a day, null if none was due. */
export function habitDayValue(habits: Habit[], index: ValidationIndex, today: string) {
  return (day: string): number | null => {
    const { due, done } = dayScore(habits, index, day, today)
    return due === 0 ? null : done / due
  }
}

/** Training activity on a day, scaled: 0 none, 0.5 one session, 1 two or more. */
export function activityDayValue(days: string[]) {
  const count = new Map<string, number>()
  for (const d of days) count.set(d, (count.get(d) ?? 0) + 1)
  return (day: string): number => Math.min(1, (count.get(day) ?? 0) / 2)
}

/** Completion rate per weekday (0 = Monday) over a period; null if never due. */
export function weekdayRates(habits: Habit[], index: ValidationIndex, from: string, to: string, today: string): (number | null)[] {
  const due = Array(7).fill(0)
  const done = Array(7).fill(0)
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const s = dayScore(habits, index, day, today)
    due[weekday(day)] += s.due
    done[weekday(day)] += s.done
  }
  return due.map((d, i) => (d === 0 ? null : done[i] / d))
}

/** Completion rate per week for the last `weeks` weeks (oldest first). */
export function weeklyRates(habits: Habit[], index: ValidationIndex, today: string, weeks: number): { monday: string; rate: number | null }[] {
  const thisMonday = mondayOf(today)
  return Array.from({ length: weeks }, (_, i) => {
    const monday = addDays(thisMonday, -7 * (weeks - 1 - i))
    let due = 0
    let done = 0
    for (let d = 0; d < 7; d++) {
      const day = addDays(monday, d)
      if (day > today) break
      const s = dayScore(habits, index, day, today)
      due += s.due
      done += s.done
    }
    return { monday, rate: due === 0 ? null : done / due }
  })
}
