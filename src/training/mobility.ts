/** Mobility: starter routines, guided steps, XP, regularity, and importing the old stretching habits. */
import { addDays } from '../domain/date'
import type { Habit } from '../domain/types'
import type { Exercise, HoldItem, LoggedSet, MobilityCategory, RoutineLevel, TrainingLog, TrainingSession } from './types'

const id = () => crypto.randomUUID()

/** Seconds to get in position before each guided step. */
export const PREP_S = 5
export const MOBILITY_XP = { base: 10, step: 1 }
/** Default hold for imported steps. */
export const DEFAULT_HOLD_S = 30

export const hold = (exercise_id: string, hold_s: number, options: Partial<Omit<HoldItem, 'id' | 'kind' | 'exercise_id' | 'hold_s'>> = {}): HoldItem => ({
  id: id(),
  kind: 'hold',
  exercise_id,
  hold_s,
  reps: options.reps ?? 0,
  sides: options.sides ?? false,
  rounds: options.rounds ?? 1,
})

export function mobilitySession(name: string, category: MobilityCategory, items: HoldItem[], levels: RoutineLevel[], position: number): TrainingSession {
  return { id: id(), name, discipline: 'mobility', place: 'home', position, warmup: '', items, finisher: false, archived: false, category, levels }
}

/** Starter routines, to adjust: the user writes their own instructions. */
export function buildMobility() {
  const exercises: Exercise[] = []
  const ex = (name: string, muscle: string, notes = '', unilateral = false) => {
    const e: Exercise = { id: id(), name, muscle, measure: 'duration', unilateral, notes }
    exercises.push(e)
    return e.id
  }
  const catCow = ex('Chat-vache', 'Dos', 'À quatre pattes, enrouler puis creuser le dos en suivant la respiration.')
  const shoulders = ex('Cercles d’épaules', 'Épaules')
  const hips90 = ex('Hanches 90/90', 'Hanches', 'Assis, les deux genoux à 90°, basculer d’un côté à l’autre.', true)
  const ankle = ex('Mobilité de cheville au mur', 'Chevilles', 'Genou vers le mur sans décoller le talon.', true)
  const worldsGreatest = ex('Fente avec rotation', 'Hanches', '', true)
  const hamstrings = ex('Étirement des ischios', 'Ischios', 'Dos long, basculer depuis les hanches.')
  const glutes = ex('Étirement des fessiers', 'Fessiers', '', true)
  const psoas = ex('Étirement du psoas', 'Hanches', 'Fente basse, rentrer le bassin.', true)
  const child = ex('Posture de l’enfant', 'Dos')
  const shoulderStretch = ex('Étirement des épaules', 'Épaules', '', true)
  const butterfly = ex('Papillon', 'Adducteurs')
  const pancake = ex('Pancake', 'Adducteurs', 'Jambes écartées, buste vers l’avant, dos long.')
  const frontSplit = ex('Grand écart facial', 'Hanches', 'Progresser avec des cales sous les mains.', true)

  const morning = [hold(catCow, 0, { reps: 10 }), hold(shoulders, 0, { reps: 10 }), hold(hips90, 30, { sides: true }), hold(ankle, 0, { reps: 10, sides: true }), hold(worldsGreatest, 0, { reps: 5, sides: true })]
  const evening = [hold(hamstrings, 45), hold(glutes, 45, { sides: true }), hold(psoas, 45, { sides: true }), hold(shoulderStretch, 30, { sides: true }), hold(child, 60)]
  const split = [hold(butterfly, 60), hold(pancake, 60), hold(psoas, 60, { sides: true }), hold(frontSplit, 90, { sides: true, rounds: 2 })]
  const level = (name: string, detail: string, items: HoldItem[]): RoutineLevel => ({ name, detail, items: items.map((i) => i.id) })

  const sessions = [
    mobilitySession('Mobilité du matin', 'mobility', morning, [level('Rapide', '2 min', morning.slice(0, 2)), level('Normal', '5 min', morning.slice(0, 4)), level('Complet', '8 min', morning)], 0),
    mobilitySession('Étirements du soir', 'stretch', evening, [level('Rapide', '3 min', [evening[0], evening[4]]), level('Normal', '6 min', evening.slice(0, 3).concat(evening[4])), level('Complet', '10 min', evening)], 1),
    mobilitySession('Séance grand écart', 'flexibility', split, [], 2),
  ]
  return { exercises, sessions }
}

export interface MobilityStep {
  item_id: string
  exercise_id: string
  round: number
  side: 'left' | 'right' | null
  /** Seconds, or 0 for a reps step. */
  hold_s: number
  reps: number
}

/** The routine (or one of its levels) as a flat list of guided steps: each round, each side. */
export function mobilitySteps(session: TrainingSession, levelIndex: number | null): MobilityStep[] {
  const level = levelIndex === null ? null : session.levels[levelIndex]
  const items = session.items.filter((i): i is HoldItem => i.kind === 'hold' && (!level || level.items.length === 0 || level.items.includes(i.id)))
  return items.flatMap((item) =>
    Array.from({ length: Math.max(1, item.rounds) }, (_, round) =>
      (item.sides ? (['left', 'right'] as const) : [null]).map((side) => ({ item_id: item.id, exercise_id: item.exercise_id, round, side, hold_s: item.hold_s, reps: item.reps })),
    ).flat(),
  )
}

/** Total time of the held steps, plus the preparation before each. */
export function routineSeconds(steps: MobilityStep[]): number {
  return steps.reduce((sum, s) => sum + (s.hold_s || 20) + PREP_S, 0)
}

/** Steps done, as logged sets (reps = seconds held, or reps done). */
export function stepsToSets(steps: MobilityStep[], done: boolean[]): LoggedSet[] {
  return steps.map((s, index) => ({ item_id: s.item_id, exercise_id: s.exercise_id, index, reps: s.hold_s || s.reps, weight: null, done: done[index] ?? false, chained: false }))
}

export function mobilityXp(done: boolean[]): number {
  const count = done.filter(Boolean).length
  return count === 0 ? 0 : MOBILITY_XP.base + MOBILITY_XP.step * count
}

/** Days in a row with at least one mobility session, ending today (or yesterday, if today is not done yet). */
export function mobilityStreak(logs: TrainingLog[], today: string): number {
  const days = new Set(logs.map((l) => l.day))
  let day = days.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (days.has(day)) {
    streak++
    day = addDays(day, -1)
  }
  return streak
}

/** Turns an old routine habit (with steps and levels) into a mobility routine with one exercise per step. */
export function importRoutineHabit(habit: Habit, position: number, category: MobilityCategory = 'stretch') {
  const exercises: Exercise[] = habit.steps.map((s) => ({ id: id(), name: s.name, muscle: '', measure: 'duration', unilateral: false, notes: '' }))
  const byStep = new Map(habit.steps.map((s, i) => [s.id, exercises[i].id]))
  const items = habit.steps.map((s) => hold(byStep.get(s.id)!, DEFAULT_HOLD_S))
  const itemOf = new Map(habit.steps.map((s, i) => [s.id, items[i].id]))
  const levels: RoutineLevel[] = habit.levels.map((l) => ({ name: l.name, detail: l.detail, items: l.steps.map((sid) => itemOf.get(sid)).filter((x): x is string => !!x) }))
  return { exercises, session: mobilitySession(habit.name, category, items, levels, position) }
}
