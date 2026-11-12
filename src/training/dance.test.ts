import { describe, expect, it } from 'vitest'
import { classesOn, formatMinutes, goalProgress, minutesBetween, minutesByStyle, sessionXp, weekClasses, type DanceClass, type DanceFigure, type DanceGoal, type DanceSession } from './dance'

const cls = (weekday: number, style: DanceClass['style'] = 'salsa'): DanceClass => ({ id: `c${weekday}`, style, weekday, start_time: '20:00', end_time: '21:30', place: '', level: '', active: true })
const session = (fields: Partial<DanceSession>): DanceSession => ({
  id: Math.random().toString(),
  style: 'salsa',
  kind: 'practice',
  day: '2026-11-10',
  start_time: null,
  duration_min: 60,
  status: 'done',
  class_id: null,
  title: '',
  note: '',
  figure_ids: [],
  family_id: null,
  xp_earned: 0,
  ...fields,
})
const figure = (fields: Partial<DanceFigure>): DanceFigure => ({ id: Math.random().toString(), style: 'bachata', name: 'Figure', status: 'to_learn', notes: '', mastered_on: null, xp_earned: 0, ...fields })
const goal = (fields: Partial<DanceGoal>): DanceGoal => ({ id: 'g', title: 'But', style: '', measure: 'figures', target: 5, start_day: '2026-11-01', due_day: null, means: [], achieved_on: null, xp_earned: 0, ...fields })

describe('danse', () => {
  it('place les cours fixes dans la semaine et repère ceux manqués', () => {
    const classes = [cls(0), cls(3, 'bachata')]
    const done = session({ kind: 'class', class_id: 'c3', day: '2026-11-12' })
    const week = weekClasses(classes, [done], '2026-11-12', '2026-11-12')
    expect(week.map((w) => [w.day, w.state])).toEqual([['2026-11-09', 'missed'], ['2026-11-12', 'done']])
    expect(classesOn(classes, '2026-11-12').map((c) => c.id)).toEqual(['c3'])
  })
  it('additionne le temps par danse', () => {
    const sessions = [session({ duration_min: 90 }), session({ style: 'kizomba', duration_min: 45 }), session({ status: 'planned', duration_min: 300 })]
    expect(minutesByStyle(sessions, '2026-11-01', '2026-11-30')).toEqual({ salsa: 90, bachata: 0, kizomba: 45 })
  })
  it('mesure un objectif depuis son début, dans sa danse', () => {
    const figures = [figure({ status: 'mastered', mastered_on: '2026-11-05' }), figure({ status: 'mastered', mastered_on: '2026-10-01' }), figure({ style: 'salsa', status: 'mastered', mastered_on: '2026-11-05' })]
    expect(goalProgress(goal({ style: 'bachata' }), [], figures)).toMatchObject({ value: 1, target: 5 })
    const socials = [session({ kind: 'social' }), session({ kind: 'social', status: 'planned' })]
    expect(goalProgress(goal({ measure: 'socials', target: 2 }), socials, []).ratio).toBe(0.5)
    expect(goalProgress(goal({ measure: 'hours', target: 10 }), [session({ duration_min: 90 })], []).value).toBe(1.5)
    const means = [{ id: 'a', text: '', done: true }, { id: 'b', text: '', done: false }]
    expect(goalProgress(goal({ measure: 'means', means }), [], [])).toMatchObject({ value: 1, target: 2 })
  })
  it('donne l’XP selon le type de séance', () => {
    expect([sessionXp('class', 90), sessionXp('social', 240), sessionXp('practice', 30), sessionXp('practice', 300)]).toEqual([20, 25, 6, 20])
  })
  it('calcule et affiche les durées', () => {
    expect(minutesBetween('20:00', '21:30')).toBe(90)
    expect(minutesBetween('22:00', '02:00')).toBe(240)
    expect([formatMinutes(45), formatMinutes(90), formatMinutes(120)]).toEqual(['45 min', '1 h 30', '2 h'])
  })
})
