import { describe, expect, it } from 'vitest'
import { addDays } from './date'
import { completeMonths, completeWeeks, completionRate, equivalence, habitBadges, habitFunStats, habitVictories, perfectDays, runs, streakBoard } from './fun'
import { indexValidations } from './schedule'
import type { Habit, Validation } from './types'

const habit = (id: string, fields: Partial<Habit> = {}): Habit => ({
  id,
  family_id: null,
  name: id,
  description: '',
  tracking: 'simple',
  goal: 1,
  unit: '',
  frequency: { type: 'daily' },
  moments: ['morning'],
  time_of_day: null,
  start_date: '2026-10-05', // a Monday
  end_date: null,
  pauses: [],
  archived: false,
  levels: [],
  steps: [],
  avoid: null,
  ...fields,
})
const v = (habit_id: string, day: string, value = 1, moment: Validation['moment'] = 'morning'): Validation => ({ id: `${habit_id}${day}`, habit_id, day, moment, value, steps: [], xp_earned: 10 })
const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i))

const a = habit('Méditation')
const b = habit('Lecture', { moments: ['evening'] })
// a: every day from Oct 5 to Nov 9; b: every day except Oct 20 and Oct 21.
const validations = [
  ...range('2026-10-05', 36).map((d) => v('Méditation', d)),
  ...range('2026-10-05', 36).filter((d) => d !== '2026-10-20' && d !== '2026-10-21').map((d) => v('Lecture', d, 1, 'evening')),
]
const index = indexValidations(validations)
const today = '2026-11-10'

describe('journées, semaines et mois parfaits', () => {
  it('repère les journées où tout est fait', () => {
    const days = perfectDays([a, b], index, today)
    expect(days).toHaveLength(34)
    expect(days).not.toContain('2026-10-20')
    expect(runs(days, today)).toEqual({ longest: 19, current: 19 })
  })
  it('tolère un oubli par semaine, pas deux', () => {
    const weeks = completeWeeks([a, b], index, today)
    expect(weeks).toContain('2026-10-12')
    expect(weeks).not.toContain('2026-10-19')
    expect(weeks).toContain('2026-11-02')
  })
  it('valide un mois à 90 %', () => {
    expect(completionRate([a, b], index, '2026-10-01', '2026-10-31', today).rate).toBeCloseTo(52 / 54)
    expect(completeMonths([a, b], index, today)).toEqual(['2026-10-01'])
  })
})

describe('séries et victoires', () => {
  it('classe les séries en cours et garde le record', () => {
    const board = streakBoard([a, b], index, today)
    expect(board[0]).toMatchObject({ current: 36, best: 36 })
    expect(board[1].best).toBe(19)
  })
  it('liste les petites victoires récentes', () => {
    const texts = habitVictories([a, b], index, today).map((x) => x.text)
    expect(texts).toContain('Journée parfaite : toutes les habitudes du jour faites')
    expect(texts.some((t) => t.includes('nouveau record de série'))).toBe(true)
    expect(texts).toContain('Semaine complète : toutes les habitudes tenues')
  })
})

describe('stats décalées et badges', () => {
  it('trouve le jour fort, le chronotype et les équivalences', () => {
    const stats = habitFunStats({ habits: [a, b], validations, tasks: [] }, index, today)
    expect(stats.totalValidations).toBe(70)
    expect(stats.chronotype).toBe('du matin')
    expect(stats.faithful?.habit.id).toBe('Méditation')
    expect(equivalence(2_600, 'kg')).toBe('2 voitures')
    expect(equivalence(300, 'min')).toBe('2,5 films')
    expect(equivalence(10, 'kg')).toBe(null)
  })
  it('débloque les badges d’habitudes à la bonne date', () => {
    const byId = Object.fromEntries(habitBadges({ habits: [a, b], validations, tasks: [] }, index, today).map((x) => [x.id, x]))
    expect(byId['habit-1'].unlocked_on).toBe('2026-10-05')
    expect(byId['streak-7'].unlocked_on).toBe('2026-10-11')
    expect(byId['streak-30'].unlocked_on).toBe('2026-11-03')
    expect(byId['month-1'].unlocked_on).toBe('2026-10-31')
    expect(byId['streak-100'].unlocked_on).toBe(null)
  })
})
