import { describe, expect, it } from 'vitest'
import { clock, draftSets, findRecords, formatDuration, nextSession, randomWod, sessionXp, volume } from './logic'
import type { Habit } from '../domain/types'
import { buildMobility, importRoutineHabit, mobilityStreak, mobilitySteps, mobilityXp } from './mobility'
import { buildProgram } from './program'
import { exerciseHistory, formatPrescription, parsePrescription, personalRecords, weeklyVolume } from './stats'
import { wodPhase } from './WodTimer'
import type { LoggedSet, TrainingLog } from './types'

const program = buildProgram()
const [t1, t2, t3] = program.sessions

const log = (session_id: string, started_at: string, sets: LoggedSet[] = []): TrainingLog => ({
  id: started_at,
  session_id,
  discipline: 'sport',
  name: '',
  day: started_at.slice(0, 10),
  started_at,
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
  xp_earned: 0,
})

describe('programme de salle', () => {
  it('pré-charge les 3 séances avec le détail des séries', () => {
    expect(program.sessions.map((s) => s.name)).toEqual(['Training 1 : Pecs / Épaules', 'Training 2 : Jambes', 'Training 3 : Bras / Dos'])
    const press = t2.items[1]
    expect(press.kind === 'exercise' && press.sets.map((s) => s.reps)).toEqual([25, 25, 20, 20, 15, 15, 10, 10, 10])
    expect(press.kind === 'exercise' && press.sets[0].note).toBe('à vide')
  })
})

describe('rotation', () => {
  it('propose la séance suivant la dernière faite, puis reboucle', () => {
    expect(nextSession(program.sessions, [])?.id).toBe(t1.id)
    expect(nextSession(program.sessions, [log(t1.id, '2026-11-03T18:00')])?.id).toBe(t2.id)
    expect(nextSession(program.sessions, [log(t2.id, '2026-11-05T18:00'), log(t3.id, '2026-11-07T18:00')])?.id).toBe(t1.id)
  })
})

describe('séance en cours', () => {
  it('prépare chaque série, avec les mouvements enchaînés', () => {
    const sets = draftSets(t2, [])
    const adductor = sets.filter((s) => s.item_id === t2.items[0].id)
    expect(adductor.map((s) => s.chained)).toEqual([false, true, false, true, false, true])
    const press = sets.filter((s) => s.item_id === t2.items[1].id)
    expect(press.filter((s) => s.chained)).toHaveLength(1)
    expect(press.at(-1)).toMatchObject({ chained: true, index: 8, reps: 10 })
    expect(press[0].weight).toBe(0)
  })
  it('reprend les charges et répétitions de la dernière fois', () => {
    const first = draftSets(t1, []).map((s, i) => ({ ...s, weight: 20 + i, reps: 12, done: true }))
    const again = draftSets(t1, [log(t1.id, '2026-11-03T18:00', first)])
    expect(again[0]).toMatchObject({ weight: 20, reps: 12, done: false })
    expect(again[3].weight).toBe(23)
  })
})

describe('records et XP', () => {
  const exercise = t1.items[0].kind === 'exercise' ? t1.items[0].exercise_id : ''
  const set = (weight: number, reps = 10): LoggedSet => ({ item_id: 'i', exercise_id: exercise, index: 0, reps, weight, done: true, chained: false })
  it('détecte une charge battue, mais pas une première fois', () => {
    expect(findRecords([set(30)], [], program.exercises)).toEqual([])
    expect(findRecords([set(32)], [log(t1.id, '2026-11-03T18:00', [set(30)])], program.exercises)).toEqual([exercise])
    expect(findRecords([set(30)], [log(t1.id, '2026-11-03T18:00', [set(30)])], program.exercises)).toEqual([])
  })
  it('calcule le volume et l’XP de séance', () => {
    expect(volume([set(20, 10), set(25, 8), { ...set(50), done: false }])).toBe(400)
    expect(sessionXp([set(20), set(20)], true, 3, true)).toBe(20 + 4 + 5 + 9 + 10)
  })
  it('tire un finisher différent du précédent', () => {
    const [a, b] = program.wods
    expect(randomWod([a, b], a.id, () => 0)?.id).toBe(b.id)
  })
  it('formate les durées', () => {
    expect(formatDuration(3725)).toBe('1 h 02')
    expect(formatDuration(754)).toBe('12 min 34')
    expect(clock(95)).toBe('1:35')
  })
})

describe('chrono du finisher', () => {
  const [amrap, emom, forTime, tabata] = program.wods
  it('décompte un AMRAP et un EMOM minute par minute', () => {
    expect(wodPhase(amrap, 0).left).toBe(480)
    expect(wodPhase(amrap, 480).over).toBe(true)
    expect(wodPhase(emom, 125)).toMatchObject({ label: 'Minute 3 / 10', left: 55 })
  })
  it('alterne effort et repos en Tabata', () => {
    expect(wodPhase(tabata, 5).label).toBe('Effort · tour 1 / 8')
    expect(wodPhase(tabata, 25)).toMatchObject({ label: 'Repos · tour 1 / 8', left: 5 })
    expect(wodPhase(tabata, 240).over).toBe(true)
  })
  it('s’arrête au temps limite d’un « for time »', () => {
    expect(wodPhase(forTime, 60).over).toBe(false)
    expect(wodPhase(forTime, 720).over).toBe(true)
  })
})

describe('suivi de progression', () => {
  const exercise = program.exercises[0]
  const set = (weight: number, reps: number): LoggedSet => ({ item_id: 'i', exercise_id: exercise.id, index: 0, reps, weight, done: true, chained: false })
  const logs = [log(t1.id, '2026-11-03T18:00', [set(20, 15), set(25, 12)]), log(t1.id, '2026-11-10T18:00', [set(27.5, 10)])]
  it('trace une séance par point, avec la charge maximale', () => {
    expect(exerciseHistory(exercise.id, logs).map((p) => [p.day, p.weight, p.reps])).toEqual([['2026-11-03', 25, 15], ['2026-11-10', 27.5, 10]])
  })
  it('calcule le volume par semaine', () => {
    expect(weeklyVolume(logs, '2026-11-10', 2).map((w) => w.volume)).toEqual([600, 275])
  })
  it('donne les records avec leur date', () => {
    expect(personalRecords(logs, program.exercises)[0]).toMatchObject({ weight: 27.5, weightDay: '2026-11-10', reps: 15, repsDay: '2026-11-03', sessions: 2 })
  })
  it('lit et réécrit une prescription', () => {
    const sets = parsePrescription('2x25 à vide / 2x20 / 3x10 tempo')
    expect(sets?.map((s) => s.reps)).toEqual([25, 25, 20, 20, 10, 10, 10])
    expect(sets && formatPrescription(sets)).toBe('2x25 à vide / 2x20 / 3x10 tempo')
    expect(parsePrescription('trois séries')).toBe(null)
  })
})

describe('mobilité', () => {
  const mob = buildMobility()
  const [morning, evening, split] = mob.sessions
  it('déroule chaque tour et chaque côté', () => {
    const steps = mobilitySteps(split, null)
    // papillon, pancake, psoas G/D, grand écart G/D × 2 tours
    expect(steps).toHaveLength(1 + 1 + 2 + 4)
    expect(steps.slice(-4).map((s) => [s.side, s.round])).toEqual([['left', 0], ['right', 0], ['left', 1], ['right', 1]])
  })
  it('ne garde que les exercices du niveau choisi', () => {
    expect(mobilitySteps(morning, 0)).toHaveLength(2)
    expect(mobilitySteps(morning, 2).length).toBeGreaterThan(mobilitySteps(morning, 1).length)
    expect(mobilitySteps(evening, null).length).toBeGreaterThan(mobilitySteps(evening, 0).length)
  })
  it('compte l’XP et la série de jours', () => {
    expect(mobilityXp([true, true, false])).toBe(12)
    expect(mobilityXp([false])).toBe(0)
    const days = ['2026-11-08', '2026-11-09', '2026-11-10'].map((d) => ({ ...log('m', `${d}T07:00`), discipline: 'mobility' as const }))
    expect(mobilityStreak(days, '2026-11-10')).toBe(3)
    expect(mobilityStreak(days.slice(0, 2), '2026-11-10')).toBe(2)
    expect(mobilityStreak(days.slice(0, 1), '2026-11-10')).toBe(0)
  })
  it('importe une routine d’habitude avec ses niveaux', () => {
    const habit = {
      name: 'Routine étirements du soir',
      steps: [{ id: 'a', name: 'Ischios' }, { id: 'b', name: 'Dos' }],
      levels: [{ name: 'Rapide', detail: '2 min', steps: ['a'] }],
    } as unknown as Habit
    const { exercises, session } = importRoutineHabit(habit, 3)
    expect(exercises.map((e) => e.name)).toEqual(['Ischios', 'Dos'])
    expect(session).toMatchObject({ discipline: 'mobility', name: 'Routine étirements du soir', position: 3 })
    expect(session.levels[0].items).toEqual([session.items[0].id])
  })
})
