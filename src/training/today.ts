/** What the Training offers today, for the "Aujourd'hui" screen. Pure functions. */
import { classesOn, type DanceClass, type DanceSession } from './dance'
import { nextSession } from './logic'
import type { TrainingLog, TrainingSession } from './types'

export interface TrainingToday {
  /** Next gym session in the rotation, and whether a sport session was already logged today. */
  sport: { session: TrainingSession; doneToday: boolean } | null
  /** Mobility routines, with whether each was done today. */
  mobility: { session: TrainingSession; doneToday: boolean }[]
  /** Dance classes held today, with whether each was attended. */
  dance: { danceClass: DanceClass; done: boolean }[]
}

export function trainingToday(
  sessions: TrainingSession[],
  logs: TrainingLog[],
  classes: DanceClass[],
  danceSessions: DanceSession[],
  today: string,
): TrainingToday {
  const next = nextSession(sessions, logs, 'gym')
  const sport = next ? { session: next, doneToday: logs.some((l) => l.discipline === 'sport' && l.day === today) } : null
  const mobility = sessions
    .filter((s) => s.discipline === 'mobility' && !s.archived)
    .sort((a, b) => a.position - b.position)
    .map((session) => ({ session, doneToday: logs.some((l) => l.session_id === session.id && l.day === today) }))
  const dance = classesOn(classes, today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((danceClass) => ({ danceClass, done: danceSessions.some((s) => s.class_id === danceClass.id && s.day === today && s.status === 'done') }))
  return { sport, mobility, dance }
}
