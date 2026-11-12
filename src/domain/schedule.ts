import { addDays, addMonths, daysBetween, firstOfMonth, mondayOf, weekday } from './date'
import type { Habit, Level, Moment, Slip, Validation } from './types'

export type ValidationIndex = Map<string, Validation>

const key = (habitId: string, day: string, moment: Moment) => `${habitId}|${day}|${moment}`

export function indexValidations(validations: Validation[]): ValidationIndex {
  return new Map(validations.map((v) => [key(v.habit_id, v.day, v.moment), v]))
}

export function getValidation(index: ValidationIndex, habitId: string, day: string, moment: Moment) {
  return index.get(key(habitId, day, moment))
}

export function isPaused(habit: Habit, day: string): boolean {
  return habit.pauses.some((p) => p.from <= day && (p.to === null || day <= p.to))
}

export function isActiveOn(habit: Habit, day: string): boolean {
  return day >= habit.start_date && (!habit.end_date || day <= habit.end_date) && !isPaused(habit, day)
}

export function isMomentDone(habit: Habit, index: ValidationIndex, day: string, moment: Moment): boolean {
  return (getValidation(index, habit.id, day, moment)?.value ?? 0) >= habit.goal
}

export function isDayDone(habit: Habit, index: ValidationIndex, day: string): boolean {
  return habit.moments.every((m) => isMomentDone(habit, index, day, m))
}

/** Habits with a quota over a week or a month have no fixed day. */
export function isQuota(habit: Habit): boolean {
  return habit.frequency.type === 'per_week' || habit.frequency.type === 'per_month'
}

/** First and last day of the quota period (week or month) that contains this day. */
export function periodOf(habit: Habit, day: string): [string, string] {
  if (habit.frequency.type === 'per_month') {
    const first = firstOfMonth(day)
    return [first, addDays(addMonths(first, 1), -1)]
  }
  const monday = mondayOf(day)
  return [monday, addDays(monday, 6)]
}

export function quotaCount(habit: Habit): number {
  const f = habit.frequency
  return f.type === 'per_week' || f.type === 'per_month' ? f.count : 1
}

export function periodDoneCount(habit: Habit, index: ValidationIndex, day: string): number {
  const [first, last] = periodOf(habit, day)
  let count = 0
  for (let d = first; d <= last; d = addDays(d, 1)) if (isDayDone(habit, index, d)) count++
  return count
}

/** Is this a scheduled day for a habit with fixed days (daily, weekdays, every N days)? */
export function isScheduledDay(habit: Habit, day: string): boolean {
  const f = habit.frequency
  if (f.type === 'weekdays') return f.days.includes(weekday(day))
  if (f.type === 'every_n') return daysBetween(habit.start_date, day) % Math.max(1, f.interval) === 0
  return true
}

/** Should this habit appear on this day? A quota hides it once met, except on days it was done. */
export function isDueOn(habit: Habit, index: ValidationIndex, day: string): boolean {
  if (habit.archived || !isActiveOn(habit, day)) return false
  if (isQuota(habit)) return isDayDone(habit, index, day) || periodDoneCount(habit, index, day) < quotaCount(habit)
  return isScheduledDay(habit, day)
}

// ——— Routines ———

/** A routine without levels has a single level made of all its steps. A level without steps means all of them. */
export function routineLevels(habit: Habit): Level[] {
  const all = habit.steps.map((s) => s.id)
  if (habit.levels.length === 0) return [{ name: 'Complète', detail: '', steps: all }]
  return habit.levels.map((l) => ({ ...l, steps: l.steps.length > 0 ? l.steps.filter((id) => all.includes(id)) : all }))
}

/** Highest level whose steps are all done, from 1; 0 if none. */
export function reachedLevel(habit: Habit, done: string[]): number {
  let reached = 0
  routineLevels(habit).forEach((level, i) => {
    if (level.steps.length > 0 && level.steps.every((id) => done.includes(id))) reached = i + 1
  })
  return reached
}

// ——— Habits to avoid ———

/** Does a slip at this time count, given the habit's time window? */
export function slipCounts(habit: Habit, time: string): boolean {
  const before = habit.avoid?.before
  const after = habit.avoid?.after
  if (before && after) return time < before || time >= after
  if (before) return time < before
  if (after) return time >= after
  return true
}

function countSlips(habit: Habit, slips: Slip[], from: string, to: string): number {
  return slips.filter((s) => s.habit_id === habit.id && s.day >= from && s.day <= to && slipCounts(habit, s.time)).length
}

export function slipsOn(habit: Habit, slips: Slip[], day: string): number {
  return countSlips(habit, slips, day, day)
}

/** Is the day still within tolerance? With a weekly tolerance, slips add up from Monday. */
export function isAvoidOk(habit: Habit, slips: Slip[], day: string): boolean {
  const tolerance = habit.avoid?.tolerance ?? 0
  const from = habit.avoid?.period === 'week' ? mondayOf(day) : day
  return countSlips(habit, slips, from, day) <= tolerance
}

/** Can the day still go wrong? It is over at the rollover, or once a "before" time limit has passed. */
export function isAvoidSettled(habit: Habit, day: string, today: string, now: string): boolean {
  if (day < today) return true
  const { before, after } = habit.avoid ?? { before: null, after: null }
  return day === today && !!before && !after && now >= before
}
