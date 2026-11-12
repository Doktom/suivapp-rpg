import { describe, expect, it } from 'vitest'
import { badgesXp, change, computeBadges, recordFeed, sportGoalProgress, weekSummary, type AchievementSource, type TrainingGoal } from './achievements'
import type { DanceSession } from './dance'
import type { Exercise, LoggedSet, TrainingLog } from './types'

const squat: Exercise = { id: 'sq', name: 'Squat', muscle: 'Jambes', measure: 'reps_weight', unilateral: false, notes: '' }
const pushup: Exercise = { id: 'pu', name: 'Pompes', muscle: 'Pecs', measure: 'reps', unilateral: false, notes: '' }
const set = (exercise_id: string, reps: number, weight: number | null): LoggedSet => ({ item_id: 'i', exercise_id, index: 0, reps, weight, done: true, chained: false })
const log = (day: string, sets: LoggedSet[], discipline: TrainingLog['discipline'] = 'sport'): TrainingLog => ({
  id: `${discipline}-${day}`,
  session_id: 's',
  discipline,
  name: '',
  day,
  started_at: `${day}T18:00:00Z`,
  duration_s: 3600,
  feeling: null,
  note: '',
  warmup_done: true,
  circuits: {},
  sets,
  wod_id: null,
  wod_result: '',
  records: [],
  family_id: null,
  xp_earned: 30,
})
const source = (logs: TrainingLog[], extra: Partial<AchievementSource> = {}): AchievementSource => ({
  training_logs: logs,
  training_exercises: [squat, pushup],
  training_goals: [],
  dance_sessions: [],
  dance_figures: [],
  dance_goals: [],
  ...extra,
})
const goal = (fields: Partial<TrainingGoal>): TrainingGoal => ({ id: 'g', title: '', measure: 'weight', exercise_id: 'sq', target: 60, start_day: '2026-11-01', due_day: null, means: [], achieved_on: null, xp_earned: 0, ...fields })

const logs = [
  log('2026-11-02', [set('sq', 10, 40), set('pu', 15, null)]),
  log('2026-11-04', [set('sq', 10, 45), set('pu', 12, null)]),
  log('2026-11-06', [set('sq', 8, 50), set('pu', 20, null)]),
]

describe('objectifs sport', () => {
  it('mesure la meilleure charge, les séances et le tonnage depuis le début', () => {
    expect(sportGoalProgress(goal({}), logs)).toMatchObject({ value: 50, target: 60 })
    expect(sportGoalProgress(goal({ measure: 'reps', exercise_id: 'pu', target: 25 }), logs).value).toBe(20)
    expect(sportGoalProgress(goal({ measure: 'sessions', target: 12, start_day: '2026-11-03' }), logs).value).toBe(2)
    expect(sportGoalProgress(goal({ measure: 'volume', target: 1000, start_day: '2026-11-05' }), logs).ratio).toBe(0.4)
  })
})

describe('records', () => {
  it('liste les records battus avec l’ancienne valeur', () => {
    const feed = recordFeed(logs, [squat, pushup])
    expect(feed.map((r) => [r.exercise.id, r.day, r.previous, r.value, r.unit])).toEqual([
      ['sq', '2026-11-04', 40, 45, 'kg'],
      ['sq', '2026-11-06', 45, 50, 'kg'],
      ['pu', '2026-11-06', 15, 20, 'reps'],
    ])
  })
})

describe('badges', () => {
  it('débloque à la bonne date et donne de l’XP', () => {
    const badges = computeBadges(source(logs))
    const byId = Object.fromEntries(badges.map((b) => [b.id, b]))
    expect(byId['sport-1'].unlocked_on).toBe('2026-11-02')
    expect(byId['sport-week'].unlocked_on).toBe('2026-11-06')
    expect(byId['tonnage-1'].unlocked_on).toBe('2026-11-06')
    expect(byId['record-1'].unlocked_on).toBe('2026-11-04')
    expect(byId['sport-10']).toMatchObject({ value: 3, unlocked_on: null })
    expect(badgesXp(badges)).toBe(4 * 20)
  })
  it('compte les jours de mobilité d’affilée', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']
    const badge = computeBadges(source(days.map((d) => log(d, [], 'mobility')))).find((b) => b.id === 'mobility-7')!
    expect(badge).toMatchObject({ value: 7, unlocked_on: '2026-11-10' })
  })
  it('suit les heures de danse', () => {
    const session = (day: string, minutes: number): DanceSession => ({ id: day, style: 'salsa', kind: 'social', day, start_time: null, duration_min: minutes, status: 'done', class_id: null, title: '', note: '', figure_ids: [], family_id: null, xp_earned: 25 })
    const badge = computeBadges(source([], { dance_sessions: [session('2026-11-01', 600), session('2026-11-08', 600)] })).find((b) => b.id === 'dance-20h')!
    expect(badge.unlocked_on).toBe('2026-11-08')
  })
})

describe('bilan de la semaine', () => {
  it('résume la semaine et compare à la précédente', () => {
    const src = source(logs)
    const week = weekSummary(src, '2026-11-02', computeBadges(src))
    expect(week).toMatchObject({ sportSessions: 3, records: 3, volume: 400 + 450 + 400 })
    expect(week.badges.map((b) => b.id)).toContain('sport-week')
    expect(change(12, 10)).toBe(20)
    expect(change(5, 0)).toBe(null)
  })
})
