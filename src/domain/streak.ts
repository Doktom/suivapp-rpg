import { addDays, addMonths, mondayOf } from './date'
import { isActiveOn, isDayDone, isQuota, isScheduledDay, periodOf, quotaCount, type ValidationIndex } from './schedule'
import type { Habit } from './types'

export interface Streak {
  current: number
  best: number
  unit: 'days' | 'weeks' | 'months'
  /** Grace is recorded by the first day of the period (week or month) that used it. */
  graceWeeks: Set<string>
  /** Days forgiven by the grace day (daily habits only). */
  graceDays: Set<string>
}

function dailyStreak(habit: Habit, index: ValidationIndex, today: string): Streak {
  const graceWeeks = new Set<string>()
  const graceDays = new Set<string>()
  let current = 0
  let best = 0
  for (let day = habit.start_date; day <= today; day = addDays(day, 1)) {
    if (!isActiveOn(habit, day) || !isScheduledDay(habit, day)) continue
    if (isDayDone(habit, index, day)) {
      current++
      best = Math.max(best, current)
    } else if (day !== today) {
      const week = mondayOf(day)
      if (current > 0 && !graceWeeks.has(week)) {
        graceWeeks.add(week)
        graceDays.add(day)
      } else current = 0
    }
  }
  return { current, best, unit: 'days', graceWeeks, graceDays }
}

/** A period (week or month) succeeds at quota; one missing session is forgiven (the quota form of the grace day). */
function quotaStreak(habit: Habit, index: ValidationIndex, today: string): Streak {
  const graceWeeks = new Set<string>()
  const quota = quotaCount(habit)
  const monthly = habit.frequency.type === 'per_month'
  const next = (start: string) => (monthly ? addMonths(start, 1) : addDays(start, 7))
  const [thisPeriod] = periodOf(habit, today)
  const [firstPeriod] = periodOf(habit, habit.start_date)
  let current = 0
  let best = 0
  for (let period = firstPeriod; period <= thisPeriod; period = next(period)) {
    const [, last] = periodOf(habit, period)
    let count = 0
    let activeDays = 0
    for (let day = period; day <= last; day = addDays(day, 1)) {
      if (day > today || !isActiveOn(habit, day)) continue
      activeDays++
      if (isDayDone(habit, index, day)) count++
    }
    if (activeDays === 0) continue
    if (count >= quota) current++
    else if (period === thisPeriod) continue
    else if (count >= Math.max(1, quota - 1)) {
      current++
      graceWeeks.add(period)
    } else if (period !== firstPeriod) current = 0
    best = Math.max(best, current)
  }
  return { current, best, unit: monthly ? 'months' : 'weeks', graceWeeks, graceDays: new Set() }
}

export function computeStreak(habit: Habit, index: ValidationIndex, today: string): Streak {
  return isQuota(habit) ? quotaStreak(habit, index, today) : dailyStreak(habit, index, today)
}

/** Streak length in days, for the XP bonus. */
export function streakDays(streak: Streak): number {
  if (streak.unit === 'weeks') return streak.current * 7
  if (streak.unit === 'months') return streak.current * 30
  return streak.current
}

export const STREAK_UNIT = { days: 'j', weeks: 'sem.', months: 'mois' } as const
