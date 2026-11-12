import { describe, expect, it } from 'vitest'
import { childrenOf, newTask, numberSubtasks, planAfterCompletion, planAvoidCredits, planFixedRecurrences, planReopen } from './automation'
import { addDays, addMonths, logicalDay, mondayOf, weekday } from './date'
import { describeFrequency, weekdaysPreset } from './describe'
import { fixedOccurrences, nextDate } from './recurrence'
import { indexValidations, isAvoidOk, isAvoidSettled, isDueOn, reachedLevel, slipCounts } from './schedule'
import { computeStreak } from './streak'
import type { Avoid, Frequency, Habit, Slip, Task, Validation } from './types'
import { levelFromXp, levelsValidationXp, levelXp, routineXp, streakBonus, validationXp, xpForNextLevel } from './xp'

const habit = (frequency: Frequency = { type: 'daily' }, overrides: Partial<Habit> = {}): Habit => ({
  id: 'h',
  family_id: null,
  name: 'Test',
  description: '',
  tracking: 'simple',
  goal: 1,
  unit: '',
  frequency,
  moments: ['morning'],
  time_of_day: null,
  start_date: '2026-11-02', // a Monday
  end_date: null,
  pauses: [],
  archived: false,
  levels: [],
  steps: [],
  avoid: null,
  ...overrides,
})

const done = (...days: string[]) =>
  indexValidations(
    days.map((day): Validation => ({ id: day, habit_id: 'h', day, moment: 'morning', value: 1, steps: [], xp_earned: 10 })),
  )

const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i))

describe('dates', () => {
  it('garde la veille avant la bascule', () => {
    expect(logicalDay(new Date(2026, 10, 9, 1, 0), 4)).toBe('2026-11-08')
    expect(logicalDay(new Date(2026, 10, 9, 4, 0), 4)).toBe('2026-11-09')
  })
  it('numérote la semaine depuis lundi', () => {
    expect(weekday('2026-11-09')).toBe(0)
    expect(weekday('2026-11-15')).toBe(6)
    expect(mondayOf('2026-11-15')).toBe('2026-11-09')
  })
})

describe('planification', () => {
  it('respecte les jours de la semaine', () => {
    const h = habit({ type: 'weekdays', days: [0, 2] })
    expect(isDueOn(h, done(), '2026-11-09')).toBe(true)
    expect(isDueOn(h, done(), '2026-11-10')).toBe(false)
  })
  it('masque une habitude hebdomadaire une fois le quota atteint', () => {
    const h = habit({ type: 'per_week', count: 2 })
    const index = done('2026-11-09', '2026-11-10')
    expect(isDueOn(h, index, '2026-11-10')).toBe(true)
    expect(isDueOn(h, index, '2026-11-11')).toBe(false)
  })
  it('exclut les habitudes archivées ou en pause', () => {
    expect(isDueOn(habit(undefined, { archived: true }), done(), '2026-11-09')).toBe(false)
    expect(isDueOn(habit(undefined, { pauses: [{ from: '2026-11-08', to: null }] }), done(), '2026-11-09')).toBe(false)
  })
})

describe('séries', () => {
  it("ne casse pas la série tant qu'aujourd'hui n'est pas fini", () => {
    expect(computeStreak(habit(), done('2026-11-02', '2026-11-03'), '2026-11-04').current).toBe(2)
  })
  it('accorde un seul jour de grâce par semaine', () => {
    const one = computeStreak(habit(), done('2026-11-02', '2026-11-04', '2026-11-05'), '2026-11-05')
    expect(one.current).toBe(3)
    expect(one.graceWeeks.has('2026-11-02')).toBe(true)
    const two = computeStreak(habit(), done('2026-11-02', '2026-11-05'), '2026-11-05')
    expect(two.current).toBe(1)
    expect(two.best).toBe(1)
  })
  it('accorde de nouveau la grâce la semaine suivante', () => {
    const days = [...range('2026-11-02', 2), ...range('2026-11-05', 5), ...range('2026-11-11', 2)]
    expect(computeStreak(habit(), done(...days), '2026-11-12').current).toBe(9)
  })
  it('ignore les jours non planifiés et les pauses', () => {
    const weekdays = habit({ type: 'weekdays', days: [0, 2] })
    expect(computeStreak(weekdays, done('2026-11-02', '2026-11-04', '2026-11-09'), '2026-11-09').current).toBe(3)
    const paused = habit(undefined, { pauses: [{ from: '2026-11-03', to: '2026-11-08' }] })
    expect(computeStreak(paused, done('2026-11-02', '2026-11-09'), '2026-11-09').current).toBe(2)
  })
  it('compte les semaines réussies pour un quota hebdomadaire', () => {
    const h = habit({ type: 'per_week', count: 2 })
    const streak = computeStreak(h, done('2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11'), '2026-11-11')
    expect(streak).toMatchObject({ current: 2, unit: 'weeks' })
  })
  it('pardonne une séance manquée sur un quota, mais pas une semaine vide', () => {
    const h = habit({ type: 'per_week', count: 2 })
    const forgiven = computeStreak(h, done('2026-11-02', '2026-11-03', '2026-11-09'), '2026-11-16')
    expect(forgiven.graceWeeks.has('2026-11-09')).toBe(true)
    expect(forgiven.current).toBe(2)
    const once = habit({ type: 'per_week', count: 1 })
    expect(computeStreak(once, done('2026-11-02'), '2026-11-17').current).toBe(0)
  })
})

describe('XP', () => {
  it('applique les paliers de bonus', () => {
    expect([6, 7, 30, 100].map(streakBonus)).toEqual([0, 0.1, 0.25, 0.5])
  })
  it('est proportionnelle et plafonnée à l’objectif', () => {
    expect(validationXp(5, 10, 0)).toBe(5)
    expect(validationXp(20, 10, 7)).toBe(11)
  })
  it('suit la courbe de niveau', () => {
    expect(xpForNextLevel(4)).toBe(800)
    expect(levelFromXp(0)).toEqual({ level: 1, xpInLevel: 0, needed: 100 })
    expect(levelFromXp(100).level).toBe(2)
  })
})

describe('V0.2 — dates et fréquences', () => {
  it('ajoute des mois en restant dans le mois', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-11-10', 2)).toBe('2027-01-10')
  })
  it('planifie tous les N jours depuis la date de début', () => {
    const h = habit({ type: 'every_n', interval: 3 })
    expect(['2026-11-02', '2026-11-03', '2026-11-05'].map((d) => isDueOn(h, done(), d))).toEqual([true, false, true])
  })
  it('ne casse pas la série les jours non prévus d’une fréquence tous les N jours', () => {
    const h = habit({ type: 'every_n', interval: 2 })
    expect(computeStreak(h, done('2026-11-02', '2026-11-04', '2026-11-06'), '2026-11-07').current).toBe(3)
  })
  it('compte les mois réussis pour un quota mensuel', () => {
    const h = habit({ type: 'per_month', count: 2 }, { start_date: '2026-10-01' })
    const streak = computeStreak(h, done('2026-10-05', '2026-10-20', '2026-11-03'), '2026-11-10')
    expect(streak).toMatchObject({ current: 1, unit: 'months' })
    expect(isDueOn(h, done('2026-11-03', '2026-11-04'), '2026-11-10')).toBe(false)
  })
})

describe('V0.2 — niveaux et routines', () => {
  it('donne 10 / 15 / 20 XP selon le niveau', () => {
    expect([0, 1, 2, 3].map((n) => levelXp(n))).toEqual([0, 10, 15, 20])
    expect(levelsValidationXp(3, 7)).toBe(22)
  })
  const routineHabit = habit(undefined, {
    tracking: 'routine',
    steps: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    levels: [{ name: 'Rapide', detail: '', steps: ['a'] }, { name: 'Complet', detail: '', steps: [] }],
  })
  it('trouve le niveau atteint d’une routine', () => {
    expect(reachedLevel(routineHabit, [])).toBe(0)
    expect(reachedLevel(routineHabit, ['a', 'b'])).toBe(1)
    expect(reachedLevel(routineHabit, ['c', 'b', 'a'])).toBe(2)
  })
  it('valide une routine sans niveau seulement quand tout est fait', () => {
    const plain = { ...routineHabit, levels: [] }
    expect(reachedLevel(plain, ['a', 'b'])).toBe(0)
    expect(reachedLevel(plain, ['a', 'b', 'c'])).toBe(1)
  })
  it('paie les étapes même pour une routine partielle', () => {
    expect(routineXp(2, 0, 0)).toBe(4)
    expect(routineXp(3, 2, 0)).toBe(21)
  })
})

describe('V0.2 — habitudes à éviter', () => {
  const slip = (day: string, time: string): Slip => ({ id: day + time, habit_id: 'h', day, time })
  const avoidHabit = (avoid: Partial<Avoid>) =>
    habit(undefined, { tracking: 'avoid', avoid: { before: null, after: null, tolerance: 0, period: 'day', ...avoid } })
  it('ne compte que les écarts dans le créneau', () => {
    const h = avoidHabit({ before: '12:00' })
    expect(isAvoidOk(h, [slip('2026-11-09', '14:00')], '2026-11-09')).toBe(true)
    expect(isAvoidOk(h, [slip('2026-11-09', '09:30')], '2026-11-09')).toBe(false)
    expect(slipCounts(avoidHabit({ after: '22:00' }), '22:30')).toBe(true)
  })
  it('applique la tolérance par jour ou par semaine', () => {
    const daily = avoidHabit({ tolerance: 1 })
    expect(isAvoidOk(daily, [slip('2026-11-09', '10:00')], '2026-11-09')).toBe(true)
    expect(isAvoidOk(daily, [slip('2026-11-09', '10:00'), slip('2026-11-09', '16:00')], '2026-11-09')).toBe(false)
    const weekly = avoidHabit({ tolerance: 2, period: 'week' })
    const slips = [slip('2026-11-09', '10:00'), slip('2026-11-10', '10:00'), slip('2026-11-11', '10:00')]
    expect(isAvoidOk(weekly, slips, '2026-11-10')).toBe(true)
    expect(isAvoidOk(weekly, slips, '2026-11-11')).toBe(false)
  })
  it('termine la journée à la bascule ou dès l’heure limite passée', () => {
    expect(isAvoidSettled(avoidHabit({}), '2026-11-09', '2026-11-10', '08:00')).toBe(true)
    expect(isAvoidSettled(avoidHabit({}), '2026-11-10', '2026-11-10', '23:00')).toBe(false)
    expect(isAvoidSettled(avoidHabit({ before: '12:00' }), '2026-11-10', '2026-11-10', '12:30')).toBe(true)
  })
})

describe('V0.2 — tâches récurrentes', () => {
  it('calcule la prochaine date', () => {
    expect(nextDate('2026-11-10', { mode: 'after', interval: 2, unit: 'week' })).toBe('2026-11-24')
    expect(nextDate('2026-01-31', { mode: 'fixed', interval: 1, unit: 'month' })).toBe('2026-02-28')
  })
  it('crée les occurrences à date fixe jusqu’à la prochaine à venir', () => {
    const monthly = { mode: 'fixed', interval: 1, unit: 'month' } as const
    expect(fixedOccurrences('2026-11-15', monthly, '2026-11-10')).toEqual([])
    expect(fixedOccurrences('2026-09-05', monthly, '2026-11-10')).toEqual(['2026-10-05', '2026-11-05', '2026-12-05'])
  })
})

describe('fréquences en semaine / week-end', () => {
  it('reconnaît et décrit les deux préréglages', () => {
    expect(weekdaysPreset([4, 3, 2, 1, 0])).toBe('workweek')
    expect(weekdaysPreset([5, 6])).toBe('weekend')
    expect(weekdaysPreset([0, 2])).toBe(null)
    expect(describeFrequency({ type: 'weekdays', days: [5, 6] })).toBe('Le week-end')
  })
  it('planifie le week-end seulement samedi et dimanche', () => {
    const h = habit({ type: 'weekdays', days: [5, 6] })
    expect(['2026-11-13', '2026-11-14', '2026-11-15'].map((d) => isDueOn(h, done(), d))).toEqual([false, true, true])
  })
})

describe('automatismes', () => {
  const task = (fields: Partial<Task> & Pick<Task, 'title'>) => newTask(fields)
  it('crédite les jours tenus et retire ceux qui ont dépassé la tolérance', () => {
    const h = habit(undefined, { tracking: 'avoid', moments: ['day'], start_date: '2026-11-08', avoid: { before: null, after: null, tolerance: 0, period: 'day' } })
    const credited: Validation = { id: 'v9', habit_id: 'h', day: '2026-11-09', moment: 'day', value: 1, steps: [], xp_earned: 10 }
    const slips: Slip[] = [{ id: 's', habit_id: 'h', day: '2026-11-09', time: '10:00' }]
    const plan = planAvoidCredits([h], indexValidations([credited]), slips, '2026-11-10', '09:00')
    expect(plan.credit.map((c) => c.day)).toEqual(['2026-11-08'])
    expect(plan.drop).toEqual(['v9'])
  })
  it('fait revenir une tâche à date fixe et chaîne les occurrences', () => {
    const rent = task({ title: 'Loyer', due_date: '2026-10-05', recurrence: { mode: 'fixed', interval: 1, unit: 'month' } })
    const [plan] = planFixedRecurrences([rent], '2026-11-10')
    expect(plan.rows.map((t) => [t.due_date, !!t.recurrence])).toEqual([['2026-10-05', false], ['2026-11-05', false], ['2026-12-05', true]])
    expect(plan.rows[2].previous_id).toBe(plan.rows[1].id)
  })
  it('crée la suivante après réalisation, avec ses sous-tâches remises à zéro', () => {
    const block = task({ title: 'Ménage', recurrence: { mode: 'after', interval: 1, unit: 'week' }, completed_at: 'x' })
    const step = task({ title: 'Aspirateur', parent_id: block.id, completed_at: 'x' })
    const rows = planAfterCompletion(block, [block, step], '2026-11-10')
    expect(rows[0].recurrence).toBe(null)
    expect(rows[1]).toMatchObject({ due_date: '2026-11-17', previous_id: block.id, completed_at: null })
    expect(rows[2]).toMatchObject({ title: 'Aspirateur', parent_id: rows[1].id, completed_at: null })
  })
  it('annule la suivante si on rouvre la tâche, tant qu’elle est intacte', () => {
    const done = task({ title: 'Draps', completed_at: 'x' })
    const [, next] = planAfterCompletion({ ...done, recurrence: { mode: 'after', interval: 2, unit: 'week' } }, [done], '2026-11-10')
    const plan = planReopen(done, [done, next])
    expect(plan?.remove.map((t) => t.id)).toEqual([next.id])
    expect(plan?.restore.recurrence).toEqual(next.recurrence)
    expect(planReopen(done, [done, { ...next, completed_at: 'y' }])).toBe(null)
  })
})

describe('ordre des sous-tâches', () => {
  it('garde l’ordre fixe des sous-tâches, quel que soit l’ordre de chargement', () => {
    const a = newTask({ title: 'Aspirateur', parent_id: 'b', position: 0 })
    const c = newTask({ title: 'Cuisine', parent_id: 'b', position: 2 })
    const s = newTask({ title: 'Serpillière', parent_id: 'b', position: 1 })
    expect(childrenOf([c, a, s], 'b').map((t) => t.title)).toEqual(['Aspirateur', 'Serpillière', 'Cuisine'])
  })
  it('numérote une seule fois les anciennes sous-tâches sans position', () => {
    const kids = ['A', 'B', 'C'].map((title) => newTask({ title, parent_id: 'b' }))
    expect(numberSubtasks(kids).map((t) => [t.title, t.position])).toEqual([['A', 0], ['B', 1], ['C', 2]])
    expect(numberSubtasks(numberSubtasks(kids))).toEqual([])
  })
})
