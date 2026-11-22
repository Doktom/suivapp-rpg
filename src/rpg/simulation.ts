/**
 * Sandbox simulation: invents weeks of play so that ranks, streaks, bosses, badges and the dungeon can be
 * tested without waiting. Pure: it returns the rows to add, the caller saves them.
 */
import type { Data } from '../data/store'
import { newTask } from '../domain/automation'
import { addDays, weekday } from '../domain/date'
import { getValidation, indexValidations, isActiveOn, isQuota, isScheduledDay, periodDoneCount, quotaCount, reachedLevel, routineLevels } from '../domain/schedule'
import { computeStreak, streakDays } from '../domain/streak'
import type { Habit, HabitTemplate, Slip, Task, Validation, XpSettings } from '../domain/types'
import { levelsValidationXp, routineXp, taskXp, validationXp } from '../domain/xp'
import { draftSets, findRecords, nextSession, sessionXp } from '../training/logic'
import type { TrainingLog } from '../training/types'
import { hashText } from './lore'

export type SimData = Pick<Data, 'habits' | 'validations' | 'slips' | 'families' | 'training_sessions' | 'training_exercises' | 'training_logs'>

export interface Assiduity {
  id: 'steady' | 'average' | 'chaotic'
  label: string
  hint: string
  /** Chance that a day is a "good" day, when nearly everything gets done. The others are slump days. */
  goodDay: number
}

export const ASSIDUITIES: Assiduity[] = [
  { id: 'steady', label: 'Régulier', hint: 'presque tous les jours', goodDay: 0.9 },
  { id: 'average', label: 'Normal', hint: 'quelques jours de creux', goodDay: 0.65 },
  { id: 'chaotic', label: 'Capricieux', hint: 'des hauts, beaucoup de bas', goodDay: 0.35 },
]

/** On a good day each habit is done with this chance, on a slump day with the other. */
const GOOD_DAY_RATE = 0.92
const SLUMP_DAY_RATE = 0.15

/** A small deterministic random generator: the same seed gives the same weeks. */
export function makeRng(seed: string): () => number {
  let a = hashText(seed) || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MISSION_TITLES = [
  'Appeler le plombier',
  'Ranger le bureau',
  'Payer la facture',
  'Répondre aux mails en retard',
  'Prendre rendez-vous chez le dentiste',
  'Faire les courses',
  'Trier les papiers',
  'Nettoyer le frigo',
  'Rapporter le colis',
  'Arroser les plantes',
]

export interface SimulationResult {
  validations: Validation[]
  slips: Slip[]
  tasks: Task[]
  logs: TrainingLog[]
}

/**
 * Plays the days from `from` (included) to `to` (excluded). Each day is good or a slump; habits, missions and
 * gym sessions follow the mood. XP is worked out with the app's own rules, streak bonus included.
 */
export function simulate({ data, xp, from, to, assiduity, seed }: { data: SimData; xp: XpSettings; from: string; to: string; assiduity: Assiduity; seed: string }): SimulationResult {
  const rng = makeRng(seed)
  const validations: Validation[] = []
  const slips: Slip[] = []
  const tasks: Task[] = []
  const logs: TrainingLog[] = []
  let known = [...data.validations]
  let index = indexValidations(known)
  const allLogs = [...data.training_logs]
  const family = data.families.find((f) => f.name === 'Sport') ?? data.families.find((f) => f.stat_name === 'Force')

  for (let day = from; day < to; day = addDays(day, 1)) {
    const weekend = weekday(day) >= 5
    const good = rng() < assiduity.goodDay - (weekend ? 0.1 : 0)
    const rate = good ? GOOD_DAY_RATE : SLUMP_DAY_RATE
    const today: Validation[] = []

    for (const habit of data.habits) {
      if (habit.archived || !isActiveOn(habit, day)) continue
      if (habit.tracking === 'avoid') {
        // A slump day may bring a slip; any other day the habit is held, and credited.
        if (!good && rng() < 0.5) {
          slips.push({ id: crypto.randomUUID(), habit_id: habit.id, day, time: '21:30' })
          continue
        }
        const moment = habit.moments[0] ?? 'day'
        if (isScheduledDay(habit, day) && !getValidation(index, habit.id, day, moment)) {
          const streak = computeStreak(habit, index, day)
          today.push({ id: crypto.randomUUID(), habit_id: habit.id, day, moment, value: 1, steps: [], xp_earned: validationXp(1, 1, streakDays(streak) + (streak.unit === 'days' ? 1 : 0), xp) })
        }
        continue
      }
      if (isQuota(habit)) {
        const span = habit.frequency.type === 'per_month' ? 30 : 7
        const wants = (quotaCount(habit) / span) * (good ? 1.6 : 0.4)
        if (periodDoneCount(habit, index, day) >= quotaCount(habit) || rng() >= wants) continue
      } else if (!isScheduledDay(habit, day)) continue

      const streak = computeStreak(habit, index, day)
      const bonusDays = streakDays(streak) + (streak.unit === 'days' ? 1 : 0)
      for (const moment of isQuota(habit) ? habit.moments.slice(0, 1) : habit.moments) {
        if (getValidation(index, habit.id, day, moment)) continue
        if (!isQuota(habit) && rng() >= rate) continue
        const made = validationFor(habit, day, moment, bonusDays, xp, rng)
        if (made) today.push(made)
      }
    }
    validations.push(...today)
    known = [...known, ...today]
    index = indexValidations(known)

    // About one mission every other day, done on time on good days.
    if (rng() < 0.45) {
      const roll = rng()
      const priority = roll < 0.2 ? 'low' : roll < 0.8 ? 'normal' : 'high'
      const done = rng() < (good ? 0.9 : 0.2)
      tasks.push(
        newTask({
          title: MISSION_TITLES[Math.floor(rng() * MISSION_TITLES.length)],
          due_date: day,
          priority,
          completed_at: done ? `${day}T12:00:00.000Z` : null,
          xp_earned: done ? taskXp(priority, xp) : 0,
        }),
      )
    }

    // Gym on Monday, Wednesday and Friday, next session of the rotation.
    if ([0, 2, 4].includes(weekday(day)) && rng() < (good ? 0.9 : 0.15)) {
      const session = nextSession(data.training_sessions, allLogs)
      if (session) {
        const sets = draftSets(session, allLogs).map((s) => ({ ...s, done: rng() < 0.96, weight: s.weight !== null && s.weight > 0 && rng() < 0.2 ? s.weight + 2.5 : s.weight }))
        const log: TrainingLog = {
          id: crypto.randomUUID(),
          session_id: session.id,
          discipline: 'sport',
          name: session.name,
          day,
          started_at: `${day}T18:30:00.000Z`,
          duration_s: 3000 + Math.floor(rng() * 1200),
          feeling: rng() < 0.6 ? 'good' : rng() < 0.5 ? 'easy' : 'hard',
          note: '',
          warmup_done: true,
          circuits: {},
          sets,
          wod_id: null,
          wod_result: '',
          records: findRecords(sets, allLogs, data.training_exercises),
          family_id: family?.id ?? null,
          xp_earned: sessionXp(sets, true, 0, false),
        }
        logs.push(log)
        allLogs.push(log)
      }
    }
  }
  return { validations, slips, tasks, logs }
}

function validationFor(habit: Habit, day: string, moment: Validation['moment'], bonusDays: number, xp: XpSettings, rng: () => number): Validation | null {
  const base = { id: crypto.randomUUID(), habit_id: habit.id, day, moment }
  if (habit.tracking === 'levels') {
    const value = 1 + Math.floor(rng() * Math.max(1, habit.levels.length))
    return { ...base, value, steps: [], xp_earned: levelsValidationXp(value, bonusDays, xp) }
  }
  if (habit.tracking === 'routine') {
    const levels = routineLevels(habit)
    const steps = levels[Math.floor(rng() * levels.length)].steps
    const level = reachedLevel(habit, steps)
    return level === 0 ? null : { ...base, value: level, steps, xp_earned: routineXp(steps.length, level, bonusDays, xp) }
  }
  return { ...base, value: habit.goal, steps: [], xp_earned: validationXp(habit.goal, habit.goal, bonusDays, xp) }
}

/** Starter habits for an empty sandbox: one template per family first, then a second round. */
export function exampleHabits(templates: HabitTemplate[], families: { id: string; position: number }[], today: string, count = 8): Habit[] {
  const order = [...families].sort((a, b) => a.position - b.position)
  const lists = order.map((f) => templates.filter((t) => t.family_id === f.id))
  const picked: HabitTemplate[] = []
  for (let round = 0; picked.length < count && lists.some((l) => l.length > round); round++) {
    for (const list of lists) if (list[round] && picked.length < count) picked.push(list[round])
  }
  return picked.map((t) => {
    const { builtin: _builtin, ...fields } = t
    return { ...fields, id: crypto.randomUUID(), description: '', time_of_day: null, start_date: today, end_date: null, pauses: [], archived: false } satisfies Habit
  })
}
