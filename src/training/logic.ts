/** Training rules, as pure functions: rotation, pre-filled sets, records, volume, XP. */
import type { Exercise, LoggedSet, Place, TrainingLog, TrainingSession, Wod } from './types'

export const TRAINING_XP = { base: 20, set: 2, warmup: 5, round: 3, finisher: 10 }

const byStart = (a: TrainingLog, b: TrainingLog) => a.started_at.localeCompare(b.started_at)

/** Active sessions of a place, in rotation order. */
export function rotation(sessions: TrainingSession[], place: Place = 'gym'): TrainingSession[] {
  return sessions.filter((s) => s.discipline === 'sport' && s.place === place && !s.archived).sort((a, b) => a.position - b.position)
}

/** The session after the last one done (Training 1 → 2 → 3 → 1…), whatever the day. */
export function nextSession(sessions: TrainingSession[], logs: TrainingLog[], place: Place = 'gym'): TrainingSession | null {
  const order = rotation(sessions, place)
  if (order.length === 0) return null
  const ids = order.map((s) => s.id)
  const last = logs.filter((l) => l.session_id && ids.includes(l.session_id)).sort(byStart).pop()
  if (!last) return order[0]
  return order[(ids.indexOf(last.session_id!) + 1) % order.length]
}

/** Sets done for an exercise in the most recent session that had it. */
export function lastSets(exerciseId: string, logs: TrainingLog[], chained = false): LoggedSet[] {
  const sorted = [...logs].sort(byStart).reverse()
  for (const log of sorted) {
    const sets = log.sets.filter((s) => s.exercise_id === exerciseId && s.done && s.chained === chained)
    if (sets.length > 0) return sets.sort((a, b) => a.index - b.index)
  }
  return []
}

/** The sets to fill during a session, pre-filled with last time's reps and weights. */
export function draftSets(session: TrainingSession, logs: TrainingLog[]): LoggedSet[] {
  const out: LoggedSet[] = []
  for (const item of session.items) {
    if (item.kind !== 'exercise') continue
    const previous = lastSets(item.exercise_id, logs)
    const previousChained = item.then ? lastSets(item.then.exercise_id, logs, true) : []
    item.sets.forEach((target, index) => {
      const before = previous.find((s) => s.index === index)
      out.push({
        item_id: item.id,
        exercise_id: item.exercise_id,
        index,
        reps: before?.reps ?? target.reps,
        weight: before?.weight ?? (target.note === 'à vide' ? 0 : null),
        done: false,
        chained: false,
      })
      const then = item.then
      if (then && (then.on === 'each' || index === item.sets.length - 1)) {
        const chainedBefore = previousChained.find((s) => s.index === index)
        out.push({
          item_id: item.id,
          exercise_id: then.exercise_id,
          index,
          reps: chainedBefore?.reps ?? then.reps,
          weight: chainedBefore?.weight ?? null,
          done: false,
          chained: true,
        })
      }
    })
  }
  return out
}

export interface Best {
  weight: number
  reps: number
}

/** Heaviest weight and most reps ever done, per exercise. */
export function bests(logs: TrainingLog[]): Map<string, Best> {
  const map = new Map<string, Best>()
  for (const log of logs) {
    for (const s of log.sets) {
      if (!s.done) continue
      const best = map.get(s.exercise_id) ?? { weight: 0, reps: 0 }
      map.set(s.exercise_id, { weight: Math.max(best.weight, s.weight ?? 0), reps: Math.max(best.reps, s.reps) })
    }
  }
  return map
}

/**
 * Exercises on which this session beats a previous best: heavier weight for weighted exercises, more reps otherwise.
 * A first time is not a record.
 */
export function findRecords(sets: LoggedSet[], previousLogs: TrainingLog[], exercises: Exercise[]): string[] {
  const before = bests(previousLogs)
  const now = bests([{ sets } as TrainingLog])
  const records: string[] = []
  for (const [exerciseId, best] of now) {
    const old = before.get(exerciseId)
    if (!old) continue
    const measure = exercises.find((e) => e.id === exerciseId)?.measure ?? 'reps_weight'
    const beaten = measure === 'reps_weight' && old.weight > 0 ? best.weight > old.weight : best.reps > old.reps
    if (beaten) records.push(exerciseId)
  }
  return records
}

/** Total weight moved: reps × weight over the sets done. */
export function volume(sets: LoggedSet[]): number {
  return sets.reduce((sum, s) => sum + (s.done ? s.reps * (s.weight ?? 0) : 0), 0)
}

export function sessionXp(sets: LoggedSet[], warmup: boolean, rounds: number, finisher: boolean): number {
  const done = sets.filter((s) => s.done).length
  return TRAINING_XP.base + TRAINING_XP.set * done + (warmup ? TRAINING_XP.warmup : 0) + TRAINING_XP.round * rounds + (finisher ? TRAINING_XP.finisher : 0)
}

/** A finisher at random, never the same as last time when there is a choice. */
export function randomWod(wods: Wod[], avoidId: string | null, random = Math.random): Wod | null {
  const pool = wods.length > 1 ? wods.filter((w) => w.id !== avoidId) : wods
  return pool.length ? pool[Math.floor(random() * pool.length)] : null
}

/** 3725 → "1 h 02", 754 → "12 min 34". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`
  return `${m} min ${String(s % 60).padStart(2, '0')}`
}

/** 95 → "1:35". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Sessions per ISO week (Monday), for the regularity view. */
export function sessionsPerWeek(logs: TrainingLog[], mondayOf: (day: string) => string): Map<string, number> {
  const map = new Map<string, number>()
  for (const l of logs) map.set(mondayOf(l.day), (map.get(mondayOf(l.day)) ?? 0) + 1)
  return map
}
