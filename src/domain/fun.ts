/**
 * The playful side of habits, as pure functions: perfect days, weeks and months, streak records,
 * small victories, quirky stats and habit badges.
 */
import { addDays, addMonths, firstOfMonth, mondayOf, weekday } from './date'
import { isActiveOn, isDayDone, isQuota, isScheduledDay, periodDoneCount, quotaCount, type ValidationIndex } from './schedule'
import type { Habit, Moment, Task, Validation } from './types'

export interface HabitSource {
  habits: Habit[]
  validations: Validation[]
  tasks: Task[]
}

const fixedHabits = (habits: Habit[]) => habits.filter((h) => !h.archived && !isQuota(h))

/** Habits with fixed days that were due on a day, and how many were done. An avoid habit still running today does not count yet. */
export function dayScore(habits: Habit[], index: ValidationIndex, day: string, today: string): { due: number; done: number } {
  let due = 0
  let done = 0
  for (const h of fixedHabits(habits)) {
    if (!isActiveOn(h, day) || !isScheduledDay(h, day)) continue
    const ok = isDayDone(h, index, day)
    if (h.tracking === 'avoid' && day === today && !ok) continue
    due++
    if (ok) done++
  }
  return { due, done }
}

const firstDay = (habits: Habit[]) => habits.reduce((min, h) => (h.start_date < min ? h.start_date : min), '9999-12-31')

/** Days where every habit due was done (at least one due). */
export function perfectDays(habits: Habit[], index: ValidationIndex, today: string): string[] {
  const out: string[] = []
  for (let day = firstDay(habits); day <= today; day = addDays(day, 1)) {
    const { due, done } = dayScore(habits, index, day, today)
    if (due > 0 && done === due) out.push(day)
  }
  return out
}

/** Longest and current runs of consecutive days in a sorted list. */
export function runs(days: string[], today: string): { longest: number; current: number } {
  let longest = 0
  let run = 0
  days.forEach((day, i) => {
    run = i > 0 && addDays(days[i - 1], 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
  })
  const last = days[days.length - 1]
  const current = last === today || last === addDays(today, -1) ? run : 0
  return { longest, current }
}

/** Share of fixed-day habits done between two days (inclusive). */
export function completionRate(habits: Habit[], index: ValidationIndex, from: string, to: string, today: string) {
  let due = 0
  let done = 0
  for (let day = from; day <= to && day <= today; day = addDays(day, 1)) {
    const s = dayScore(habits, index, day, today)
    due += s.due
    done += s.done
  }
  return { due, done, rate: due ? done / due : 0 }
}

/**
 * A complete week: each fixed-day habit missed at most once (its grace day) and each weekly quota met.
 * Only finished weeks count.
 */
export function isWeekComplete(habits: Habit[], index: ValidationIndex, monday: string, today: string): boolean {
  const sunday = addDays(monday, 6)
  if (sunday >= today) return false
  let any = false
  for (const h of habits.filter((x) => !x.archived)) {
    if (h.frequency.type === 'per_month') continue
    if (h.frequency.type === 'per_week') {
      if (!isActiveOn(h, monday) && !isActiveOn(h, sunday)) continue
      any = true
      if (periodDoneCount(h, index, monday) < quotaCount(h)) return false
      continue
    }
    let missed = 0
    for (let d = monday; d <= sunday; d = addDays(d, 1)) {
      if (!isActiveOn(h, d) || !isScheduledDay(h, d)) continue
      any = true
      if (!isDayDone(h, index, d)) missed++
    }
    if (missed > 1) return false
  }
  return any
}

/** Finished weeks that were complete, newest first. */
export function completeWeeks(habits: Habit[], index: ValidationIndex, today: string): string[] {
  const out: string[] = []
  for (let monday = mondayOf(addDays(today, -7)); monday >= mondayOf(firstDay(habits)); monday = addDays(monday, -7)) {
    if (isWeekComplete(habits, index, monday, today)) out.push(monday)
  }
  return out
}

/** A complete month: at least 90 % of the fixed-day habits done over a finished month. */
export const MONTH_THRESHOLD = 0.9

export function completeMonths(habits: Habit[], index: ValidationIndex, today: string): string[] {
  const out: string[] = []
  const start = firstOfMonth(firstDay(habits))
  for (let first = addMonths(firstOfMonth(today), -1); first >= start; first = addMonths(first, -1)) {
    const last = addDays(addMonths(first, 1), -1)
    const { due, rate } = completionRate(habits, index, first, last, today)
    if (due > 0 && rate >= MONTH_THRESHOLD) out.push(first)
  }
  return out
}

/** Day by day streak of a habit with fixed days (same rule as streak.ts, grace day included). */
export function streakTimeline(habit: Habit, index: ValidationIndex, today: string): { day: string; current: number }[] {
  const out: { day: string; current: number }[] = []
  const graceWeeks = new Set<string>()
  let current = 0
  for (let day = habit.start_date; day <= today; day = addDays(day, 1)) {
    if (!isActiveOn(habit, day) || !isScheduledDay(habit, day)) continue
    if (isDayDone(habit, index, day)) current++
    else if (day !== today) {
      const week = mondayOf(day)
      if (current > 0 && !graceWeeks.has(week)) graceWeeks.add(week)
      else current = 0
    }
    out.push({ day, current })
  }
  return out
}

export interface StreakEntry {
  habit: Habit
  current: number
  best: number
  bestDay: string | null
}

/** Current and best streak (in days) of every habit with fixed days, best current first. */
export function streakBoard(habits: Habit[], index: ValidationIndex, today: string): StreakEntry[] {
  return fixedHabits(habits)
    .map((habit) => {
      const timeline = streakTimeline(habit, index, today)
      let best = 0
      let bestDay: string | null = null
      for (const t of timeline) if (t.current > best) {
        best = t.current
        bestDay = t.day
      }
      return { habit, current: timeline[timeline.length - 1]?.current ?? 0, best, bestDay }
    })
    .sort((a, b) => b.current - a.current || b.best - a.best)
}

export const STREAK_MILESTONES = [7, 14, 30, 50, 100, 200, 365]

export interface Victory {
  day: string
  text: string
}

/** Small victories of the last days: perfect days, streak milestones, new streak records, complete weeks. */
export function habitVictories(habits: Habit[], index: ValidationIndex, today: string, days = 14): Victory[] {
  const from = addDays(today, -days + 1)
  const out: Victory[] = []
  for (const d of perfectDays(habits, index, today).filter((d) => d >= from)) out.push({ day: d, text: 'Journée parfaite : toutes les habitudes du jour faites' })
  for (const habit of fixedHabits(habits)) {
    let best = 0
    let previous = 0
    let announced = false
    for (const t of streakTimeline(habit, index, today)) {
      const recent = t.day >= from
      if (t.current < previous) announced = false
      if (recent && t.current > previous && STREAK_MILESTONES.includes(t.current)) out.push({ day: t.day, text: `${habit.name} : ${t.current} jours de série` })
      // A new streak record, announced once per run (when it first passes the old best of at least 3 days).
      else if (recent && t.current > best && best >= 3 && !announced) {
        out.push({ day: t.day, text: `${habit.name} : nouveau record de série (${t.current} j)` })
        announced = true
      }
      best = Math.max(best, t.current)
      previous = t.current
    }
  }
  for (const w of completeWeeks(habits, index, today).filter((w) => addDays(w, 6) >= from)) out.push({ day: addDays(w, 6), text: 'Semaine complète : toutes les habitudes tenues' })
  return out.sort((a, b) => b.day.localeCompare(a.day))
}

// ——— Quirky stats ———

export const WEEKDAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const MOMENT_PEOPLE: Record<Moment, string> = { morning: 'du matin', day: 'de la journée', evening: 'du soir' }

export interface HabitFunStats {
  totalValidations: number
  bestDay: { day: string; count: number } | null
  busiestWeekday: string | null
  /** "du matin", "du soir"… */
  chronotype: string | null
  avoidDaysHeld: number
  minutesInvested: number
  tasksDone: number
  faithful: { habit: Habit; rate: number } | null
  shy: { habit: Habit; rate: number } | null
}

const RATE_WINDOW_DAYS = 30
const RATE_MIN_DUE = 5

export function habitFunStats(src: HabitSource, index: ValidationIndex, today: string): HabitFunStats {
  const byDay = new Map<string, number>()
  const byWeekday = Array(7).fill(0)
  const byMoment: Record<Moment, number> = { morning: 0, day: 0, evening: 0 }
  const habitById = new Map(src.habits.map((h) => [h.id, h]))
  let avoidDaysHeld = 0
  let minutesInvested = 0
  for (const v of src.validations) {
    byDay.set(v.day, (byDay.get(v.day) ?? 0) + 1)
    byWeekday[weekday(v.day)]++
    byMoment[v.moment]++
    const habit = habitById.get(v.habit_id)
    if (habit?.tracking === 'avoid') avoidDaysHeld++
    if (habit?.tracking === 'duration') minutesInvested += v.value
  }
  let bestDay: HabitFunStats['bestDay'] = null
  for (const [day, count] of byDay) if (!bestDay || count > bestDay.count) bestDay = { day, count }
  const maxWeekday = Math.max(...byWeekday)
  const topMoment = (Object.keys(byMoment) as Moment[]).sort((a, b) => byMoment[b] - byMoment[a])[0]

  // Most and least faithful habit over the last 30 days.
  const from = addDays(today, -RATE_WINDOW_DAYS + 1)
  const rates = fixedHabits(src.habits)
    .map((habit) => {
      let due = 0
      let done = 0
      for (let d = from; d <= today; d = addDays(d, 1)) {
        if (!isActiveOn(habit, d) || !isScheduledDay(habit, d) || (d === today && !isDayDone(habit, index, d))) continue
        due++
        if (isDayDone(habit, index, d)) done++
      }
      return { habit, due, rate: due ? done / due : 0 }
    })
    .filter((r) => r.due >= RATE_MIN_DUE)
    .sort((a, b) => b.rate - a.rate)

  return {
    totalValidations: src.validations.length,
    bestDay,
    busiestWeekday: maxWeekday > 0 ? WEEKDAY_NAMES[byWeekday.indexOf(maxWeekday)] : null,
    chronotype: src.validations.length ? MOMENT_PEOPLE[topMoment] : null,
    avoidDaysHeld,
    minutesInvested,
    tasksDone: src.tasks.filter((t) => t.completed_at && !t.parent_id).length,
    faithful: rates[0] ? { habit: rates[0].habit, rate: rates[0].rate } : null,
    shy: rates.length > 1 ? { habit: rates[rates.length - 1].habit, rate: rates[rates.length - 1].rate } : null,
  }
}

/** Fun equivalences: 1 300 kg is "a car", 135 min is "a film"… */
export function equivalence(amount: number, unit: 'kg' | 'min'): string | null {
  const table: [number, string, string][] =
    unit === 'kg'
      ? [[5_000, 'éléphant', 'éléphants'], [1_300, 'voiture', 'voitures'], [250, 'piano droit', 'pianos droits'], [70, 'machine à laver', 'machines à laver']]
      : [[60 * 24, 'journée entière', 'journées entières'], [120, 'film', 'films'], [45, 'épisode de série', 'épisodes de série']]
  for (const [size, one, many] of table) {
    if (amount >= size) {
      const n = Math.round((amount / size) * 10) / 10
      return `${n.toLocaleString('fr-FR')} ${n >= 2 ? many : one}`
    }
  }
  return null
}

// ——— Habit badges ———

export interface DatedBadge {
  id: string
  title: string
  description: string
  value: number
  target: number
  unlocked_on: string | null
}

const count = (id: string, title: string, description: string, days: string[], target: number): DatedBadge => {
  const sorted = [...days].sort()
  return { id, title, description, value: sorted.length, target, unlocked_on: sorted.length >= target ? sorted[target - 1] : null }
}

export function habitBadges(src: HabitSource, index: ValidationIndex, today: string): DatedBadge[] {
  const validationDays = src.validations.map((v) => v.day)
  const perfect = perfectDays(src.habits, index, today)
  const weeks = completeWeeks(src.habits, index, today).map((w) => addDays(w, 6))
  const months = completeMonths(src.habits, index, today).map((m) => addDays(addMonths(m, 1), -1))
  const habitById = new Map(src.habits.map((h) => [h.id, h]))
  const avoidDays = src.validations.filter((v) => habitById.get(v.habit_id)?.tracking === 'avoid').map((v) => v.day)
  const morning = src.validations.filter((v) => v.moment === 'morning').map((v) => v.day)
  const tasks = src.tasks.filter((t) => t.completed_at && !t.parent_id).map((t) => t.completed_at!.slice(0, 10))

  // First day any habit reached a streak of N days.
  const streakDay = (n: number) => {
    let first: string | null = null
    let best = 0
    for (const h of fixedHabits(src.habits)) {
      for (const t of streakTimeline(h, index, today)) {
        best = Math.max(best, t.current)
        if (t.current >= n) {
          if (!first || t.day < first) first = t.day
          break
        }
      }
    }
    return { first, best }
  }
  const streak = (id: string, title: string, n: number): DatedBadge => {
    const { first, best } = streakDay(n)
    return { id, title, description: `Une série de ${n} jours sur une habitude`, value: best, target: n, unlocked_on: first }
  }

  return [
    count('habit-1', 'C’est parti', 'Valider une première habitude', validationDays, 1),
    count('habit-100', 'Cent coches', '100 validations d’habitudes', validationDays, 100),
    count('habit-1000', 'Mille coches', '1 000 validations d’habitudes', validationDays, 1000),
    streak('streak-7', 'Une semaine tenue', 7),
    streak('streak-30', 'Un mois tenu', 30),
    streak('streak-100', 'Cent jours', 100),
    count('perfect-1', 'Journée parfaite', 'Toutes les habitudes d’un jour faites', perfect, 1),
    count('perfect-10', 'Dix journées parfaites', '10 journées parfaites', perfect, 10),
    count('week-1', 'Semaine complète', 'Une semaine où tout est tenu (un oubli pardonné par habitude)', weeks, 1),
    count('week-4', 'Quatre semaines complètes', '4 semaines complètes', weeks, 4),
    count('month-1', 'Mois complet', 'Un mois à au moins 90 % de réussite', months, 1),
    count('avoid-30', 'Résistance', '30 jours tenus sur des habitudes à éviter', avoidDays, 30),
    count('morning-30', 'Lève-tôt', '30 habitudes du matin validées', morning, 30),
    count('tasks-10', 'Efficace', '10 tâches terminées', tasks, 10),
    count('tasks-100', 'Machine à cocher', '100 tâches terminées', tasks, 100),
  ]
}
