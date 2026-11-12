/** Progress tracking for sport, as pure functions: history per exercise, weekly volume, records, prescriptions. */
import { addDays, mondayOf } from '../domain/date'
import { volume } from './logic'
import type { Exercise, LoggedSet, SetTarget, TrainingLog } from './types'

const byStart = (a: TrainingLog, b: TrainingLog) => a.started_at.localeCompare(b.started_at)

export interface ExercisePoint {
  day: string
  logId: string
  /** Heaviest set of the session (0 without weight). */
  weight: number
  /** Most reps in one set. */
  reps: number
  volume: number
  sets: LoggedSet[]
}

/** One point per session where the exercise was done, oldest first. */
export function exerciseHistory(exerciseId: string, logs: TrainingLog[]): ExercisePoint[] {
  return [...logs]
    .sort(byStart)
    .map((log) => ({ log, sets: log.sets.filter((s) => s.exercise_id === exerciseId && s.done) }))
    .filter(({ sets }) => sets.length > 0)
    .map(({ log, sets }) => ({
      day: log.day,
      logId: log.id,
      weight: Math.max(0, ...sets.map((s) => s.weight ?? 0)),
      reps: Math.max(...sets.map((s) => s.reps)),
      volume: volume(sets),
      sets,
    }))
}

/** Total weight moved per week, oldest first, ending with the current week. */
export function weeklyVolume(logs: TrainingLog[], today: string, weeks: number): { week: string; volume: number; sessions: number }[] {
  const thisWeek = mondayOf(today)
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(thisWeek, -7 * (weeks - 1 - i))
    const inWeek = logs.filter((l) => mondayOf(l.day) === week)
    return { week, volume: inWeek.reduce((sum, l) => sum + volume(l.sets), 0), sessions: inWeek.length }
  })
}

export interface PersonalRecord {
  exercise: Exercise
  weight: number
  weightDay: string | null
  reps: number
  repsDay: string | null
  sessions: number
  lastDay: string
}

/** Best weight and best reps per exercise, with the day each was set. Most recently trained first. */
export function personalRecords(logs: TrainingLog[], exercises: Exercise[]): PersonalRecord[] {
  const out: PersonalRecord[] = []
  for (const exercise of exercises) {
    const history = exerciseHistory(exercise.id, logs)
    if (history.length === 0) continue
    const heaviest = history.reduce((a, b) => (b.weight > a.weight ? b : a))
    const mostReps = history.reduce((a, b) => (b.reps > a.reps ? b : a))
    out.push({
      exercise,
      weight: heaviest.weight,
      weightDay: heaviest.weight > 0 ? heaviest.day : null,
      reps: mostReps.reps,
      repsDay: mostReps.day,
      sessions: history.length,
      lastDay: history[history.length - 1].day,
    })
  }
  return out.sort((a, b) => b.lastDay.localeCompare(a.lastDay) || a.exercise.name.localeCompare(b.exercise.name, 'fr'))
}

/** Sets as written in a program: "2x15 / 3x10 tempo", "2x25 à vide / 2x20". */
export function formatPrescription(sets: SetTarget[]): string {
  const groups: string[] = []
  let i = 0
  while (i < sets.length) {
    const s = sets[i]
    let n = 1
    while (i + n < sets.length && sets[i + n].reps === s.reps && sets[i + n].note === s.note && sets[i + n].tempo === s.tempo) n++
    groups.push([`${n}x${s.reps}`, s.note, s.tempo ? 'tempo' : ''].filter(Boolean).join(' '))
    i += n
  }
  return groups.join(' / ')
}

/** The reverse of formatPrescription; null if the text cannot be read. */
export function parsePrescription(text: string): SetTarget[] | null {
  const parts = text.split('/').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const sets: SetTarget[] = []
  for (const part of parts) {
    const match = part.match(/^(\d+)\s*[x×]\s*(\d+)\s*(.*)$/i)
    if (!match) return null
    const [, count, reps, rest] = match
    const tempo = /tempo/i.test(rest)
    const note = rest.replace(/tempo/i, '').trim()
    for (let k = 0; k < Number(count); k++) sets.push({ reps: Number(reps), note, tempo })
  }
  return sets.length > 0 && sets.length <= 30 ? sets : null
}
