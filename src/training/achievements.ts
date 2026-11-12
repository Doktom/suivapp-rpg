/** The playful side of training, as pure functions: sport goals, record feed, badges and the weekly summary. */
import { addDays, mondayOf } from '../domain/date'
import type { DanceFigure, DanceGoal, DanceSession, GoalMean } from './dance'
import { volume } from './logic'
import type { Exercise, TrainingLog } from './types'

// ——— Sport goals ———

export type SportGoalMeasure = 'weight' | 'reps' | 'sessions' | 'volume'

export const SPORT_GOAL_LABELS: Record<SportGoalMeasure, string> = {
  weight: 'Charge sur un exercice (kg)',
  reps: 'Répétitions sur un exercice',
  sessions: 'Séances de sport',
  volume: 'Tonnage soulevé (kg)',
}

/** A sport goal, e.g. "Squat 60 kg" or "12 séances ce mois", with the means to reach it. */
export interface TrainingGoal {
  id: string
  title: string
  measure: SportGoalMeasure
  /** For weight and reps goals. */
  exercise_id: string | null
  target: number
  start_day: string
  due_day: string | null
  means: GoalMean[]
  achieved_on: string | null
  xp_earned: number
}

export const GOAL_XP = 50

const sportLogs = (logs: TrainingLog[]) => logs.filter((l) => l.discipline === 'sport')

/**
 * Where a sport goal stands. Weight and reps count the best ever done (a level to reach);
 * sessions and tonnage count from the goal's start.
 */
export function sportGoalProgress(goal: TrainingGoal, logs: TrainingLog[]): { value: number; target: number; ratio: number } {
  const target = Math.max(1, goal.target)
  let value = 0
  if (goal.measure === 'weight' || goal.measure === 'reps') {
    for (const l of logs) for (const s of l.sets) {
      if (!s.done || s.exercise_id !== goal.exercise_id) continue
      value = Math.max(value, goal.measure === 'weight' ? (s.weight ?? 0) : s.reps)
    }
  } else {
    const since = sportLogs(logs).filter((l) => l.day >= goal.start_day)
    value = goal.measure === 'sessions' ? since.length : Math.round(since.reduce((sum, l) => sum + volume(l.sets), 0))
  }
  return { value, target, ratio: Math.min(1, value / target) }
}

// ——— Records ———

export interface RecordEntry {
  logId: string
  day: string
  exercise: Exercise
  value: number
  previous: number
  unit: 'kg' | 'reps'
}

/**
 * Every record beaten, oldest first: a heavier weight on weighted exercises, more reps otherwise.
 * Same rule as findRecords: a first time is not a record.
 */
export function recordFeed(logs: TrainingLog[], exercises: Exercise[]): RecordEntry[] {
  const best = new Map<string, number>()
  const feed: RecordEntry[] = []
  const sorted = [...sportLogs(logs)].sort((a, b) => a.started_at.localeCompare(b.started_at))
  for (const log of sorted) {
    const inLog = new Map<string, number>()
    for (const s of log.sets) {
      if (!s.done) continue
      const exercise = exercises.find((e) => e.id === s.exercise_id)
      if (!exercise) continue
      const weighted = exercise.measure === 'reps_weight' && (s.weight ?? 0) > 0
      const value = weighted ? (s.weight ?? 0) : s.reps
      inLog.set(s.exercise_id, Math.max(inLog.get(s.exercise_id) ?? 0, value))
    }
    for (const [id, value] of inLog) {
      const previous = best.get(id)
      if (previous !== undefined && value > previous) {
        const exercise = exercises.find((e) => e.id === id)!
        const unit = exercise.measure === 'reps_weight' && log.sets.some((s) => s.exercise_id === id && (s.weight ?? 0) > 0) ? 'kg' : 'reps'
        feed.push({ logId: log.id, day: log.day, exercise, value, previous, unit })
      }
      best.set(id, Math.max(previous ?? 0, value))
    }
  }
  return feed
}

// ——— Badges ———

export type BadgeGroup = 'habits' | 'sport' | 'mobility' | 'dance' | 'goals'

export const BADGE_GROUP_LABELS: Record<BadgeGroup, string> = { habits: 'Habitudes et tâches', sport: 'Sport', mobility: 'Mobilité', dance: 'Danse', goals: 'Objectifs' }

export interface Badge {
  id: string
  group: BadgeGroup
  title: string
  description: string
  value: number
  target: number
  unlocked_on: string | null
}

export const BADGE_XP = 20

export interface AchievementSource {
  training_logs: TrainingLog[]
  training_exercises: Exercise[]
  training_goals: TrainingGoal[]
  dance_sessions: DanceSession[]
  dance_figures: DanceFigure[]
  dance_goals: DanceGoal[]
}

/** Unlocked on the day the n-th dated event happened. */
function countBadge(id: string, group: BadgeGroup, title: string, description: string, days: string[], target: number): Badge {
  const sorted = [...days].sort()
  return { id, group, title, description, value: sorted.length, target, unlocked_on: sorted.length >= target ? sorted[target - 1] : null }
}

/** Unlocked on the day a running total reached the target. */
function totalBadge(id: string, group: BadgeGroup, title: string, description: string, entries: { day: string; amount: number }[], target: number): Badge {
  let total = 0
  let unlocked: string | null = null
  for (const e of [...entries].sort((a, b) => a.day.localeCompare(b.day))) {
    total += e.amount
    if (unlocked === null && total >= target) unlocked = e.day
  }
  return { id, group, title, description, value: Math.round(total), target, unlocked_on: unlocked }
}

/** Unlocked on the day a run of consecutive days reached the target. */
function streakBadge(id: string, group: BadgeGroup, title: string, description: string, days: string[], target: number): Badge {
  const unique = [...new Set(days)].sort()
  let run = 0
  let longest = 0
  let unlocked: string | null = null
  unique.forEach((day, i) => {
    run = i > 0 && addDays(unique[i - 1], 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    if (unlocked === null && run >= target) unlocked = day
  })
  return { id, group, title, description, value: longest, target, unlocked_on: unlocked }
}

/** Unlocked on the day of the target-th session within one week. */
function busyWeekBadge(id: string, title: string, description: string, days: string[], target: number): Badge {
  const byWeek = new Map<string, string[]>()
  for (const d of [...days].sort()) byWeek.set(mondayOf(d), [...(byWeek.get(mondayOf(d)) ?? []), d])
  let unlocked: string | null = null
  let best = 0
  for (const list of byWeek.values()) {
    best = Math.max(best, list.length)
    if (list.length >= target && (unlocked === null || list[target - 1] < unlocked)) unlocked = list[target - 1]
  }
  return { id, group: 'sport', title, description, value: best, target, unlocked_on: unlocked }
}

export function computeBadges(src: AchievementSource): Badge[] {
  const sport = sportLogs(src.training_logs)
  const sportDays = sport.map((l) => l.day)
  const tonnage = sport.map((l) => ({ day: l.day, amount: volume(l.sets) }))
  const records = recordFeed(src.training_logs, src.training_exercises).map((r) => r.day)
  const mobilityDays = src.training_logs.filter((l) => l.discipline === 'mobility').map((l) => l.day)
  const danceDone = src.dance_sessions.filter((s) => s.status === 'done')
  const classes = danceDone.filter((s) => s.kind === 'class').map((s) => s.day)
  const socials = danceDone.filter((s) => s.kind === 'social').map((s) => s.day)
  const figures = src.dance_figures.filter((f) => f.status === 'mastered' && f.mastered_on).map((f) => f.mastered_on!)
  const goals = [...src.dance_goals, ...src.training_goals].filter((g) => g.achieved_on).map((g) => g.achieved_on!)

  return [
    countBadge('sport-1', 'sport', 'Premier pas', 'Terminer une première séance de sport', sportDays, 1),
    countBadge('sport-10', 'sport', 'Habitué·e', '10 séances de sport', sportDays, 10),
    countBadge('sport-50', 'sport', 'Pilier de la salle', '50 séances de sport', sportDays, 50),
    countBadge('sport-100', 'sport', 'Centurion', '100 séances de sport', sportDays, 100),
    busyWeekBadge('sport-week', 'Semaine complète', '3 séances de sport dans la même semaine', sportDays, 3),
    totalBadge('tonnage-1', 'sport', 'Une tonne', '1 000 kg soulevés au total', tonnage, 1_000),
    totalBadge('tonnage-10', 'sport', 'Dix tonnes', '10 000 kg soulevés au total', tonnage, 10_000),
    totalBadge('tonnage-100', 'sport', 'Cent tonnes', '100 000 kg soulevés au total', tonnage, 100_000),
    countBadge('record-1', 'sport', 'Premier record', 'Battre un record personnel', records, 1),
    countBadge('record-10', 'sport', 'Collection de records', '10 records battus', records, 10),
    countBadge('mobility-1', 'mobility', 'Souple d’esprit', 'Terminer une première routine', mobilityDays, 1),
    streakBadge('mobility-7', 'mobility', 'Une semaine souple', '7 jours de mobilité d’affilée', mobilityDays, 7),
    streakBadge('mobility-30', 'mobility', 'Un mois souple', '30 jours de mobilité d’affilée', mobilityDays, 30),
    countBadge('mobility-50', 'mobility', 'Élastique', '50 routines', mobilityDays, 50),
    countBadge('dance-class-1', 'dance', 'Premier cours', 'Valider un premier cours', classes, 1),
    countBadge('dance-class-10', 'dance', 'Assidu·e', '10 cours suivis', classes, 10),
    countBadge('dance-social-1', 'dance', 'Sur la piste', 'Une première soirée', socials, 1),
    countBadge('dance-social-10', 'dance', 'Noctambule', '10 soirées', socials, 10),
    countBadge('figure-1', 'dance', 'Première figure', 'Maîtriser une figure', figures, 1),
    countBadge('figure-10', 'dance', 'Répertoire', '10 figures maîtrisées', figures, 10),
    totalBadge('dance-20h', 'dance', '20 heures de danse', '20 h de cours, soirées et pratique', danceDone.map((s) => ({ day: s.day, amount: s.duration_min / 60 })), 20),
    countBadge('goal-1', 'goals', 'Mission accomplie', 'Atteindre un premier objectif', goals, 1),
    countBadge('goal-5', 'goals', 'Cap sur cap', '5 objectifs atteints', goals, 5),
  ]
}

export const badgesXp = (badges: Badge[]) => badges.filter((b) => b.unlocked_on).length * BADGE_XP

// ——— Weekly summary ———

export interface WeekSummary {
  monday: string
  sportSessions: number
  volume: number
  records: number
  mobilityRoutines: number
  mobilityDays: number
  danceMinutes: number
  xp: number
  badges: Badge[]
}

export function weekSummary(src: AchievementSource, monday: string, badges: Badge[]): WeekSummary {
  const end = addDays(monday, 6)
  const inWeek = (day: string) => day >= monday && day <= end
  const logs = src.training_logs.filter((l) => inWeek(l.day))
  const sport = logs.filter((l) => l.discipline === 'sport')
  const mobility = logs.filter((l) => l.discipline === 'mobility')
  const dance = src.dance_sessions.filter((s) => s.status === 'done' && inWeek(s.day))
  const unlocked = badges.filter((b) => b.unlocked_on && inWeek(b.unlocked_on))
  return {
    monday,
    sportSessions: sport.length,
    volume: Math.round(sport.reduce((sum, l) => sum + volume(l.sets), 0)),
    records: recordFeed(src.training_logs, src.training_exercises).filter((r) => inWeek(r.day)).length,
    mobilityRoutines: mobility.length,
    mobilityDays: new Set(mobility.map((l) => l.day)).size,
    danceMinutes: dance.reduce((sum, s) => sum + s.duration_min, 0),
    xp: logs.reduce((sum, l) => sum + l.xp_earned, 0) + dance.reduce((sum, s) => sum + s.xp_earned, 0) + unlocked.length * BADGE_XP,
    badges: unlocked,
  }
}

/** Change from last week, in percent (null when there is nothing to compare with). */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
