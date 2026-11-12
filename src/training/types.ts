/** Training module: sport sessions, their exercises, finishers and the log of what was done. */

export type Discipline = 'sport' | 'mobility' | 'dance'
export type Place = 'gym' | 'home'

/** How an exercise is measured. */
export type Measure = 'reps_weight' | 'reps' | 'duration'

export interface Exercise {
  id: string
  name: string
  /** Muscle group or body area, e.g. "Pecs". */
  muscle: string
  measure: Measure
  /** Done one side at a time: reps are per side. */
  unilateral: boolean
  notes: string
}

/** One prescribed set. */
export interface SetTarget {
  reps: number
  /** e.g. "à vide" for an empty warm-up set. */
  note: string
  tempo: boolean
}

/** A movement chained to the sets of an exercise, e.g. abductors after adductors, or lunges after the last set. */
export interface Chained {
  exercise_id: string
  reps: number
  on: 'each' | 'last'
}

export interface ExerciseItem {
  id: string
  kind: 'exercise'
  exercise_id: string
  sets: SetTarget[]
  rest_s: number
  then: Chained | null
  note: string
}

/** A short circuit done in rounds, e.g. abs and core, 3 to 4 rounds. */
export interface CircuitItem {
  id: string
  kind: 'circuit'
  name: string
  rounds_min: number
  rounds_max: number
  content: string
}

/** A mobility or stretching exercise: held for a time (or done for reps), on one or both sides, for some rounds. */
export interface HoldItem {
  id: string
  kind: 'hold'
  exercise_id: string
  /** Seconds to hold; 0 when the exercise is counted in reps instead. */
  hold_s: number
  reps: number
  /** Left then right. */
  sides: boolean
  rounds: number
}

export type SessionItem = ExerciseItem | CircuitItem | HoldItem

/** Kinds of mobility routines. */
export type MobilityCategory = 'mobility' | 'stretch' | 'physio' | 'flexibility'

/** A lighter or fuller version of a routine; `items` empty means all of them. */
export interface RoutineLevel {
  name: string
  detail: string
  items: string[]
}

/** A session template, e.g. "Training 2 : Jambes". Gym sessions rotate in `position` order. */
export interface TrainingSession {
  id: string
  name: string
  discipline: Discipline
  place: Place
  position: number
  warmup: string
  items: SessionItem[]
  finisher: boolean
  archived: boolean
  /** Mobility routines only. */
  category: MobilityCategory | ''
  levels: RoutineLevel[]
}

export type WodFormat = 'amrap' | 'emom' | 'for_time' | 'tabata'

/** A short bodyweight workout for the finisher. */
export interface Wod {
  id: string
  name: string
  format: WodFormat
  /** AMRAP / EMOM length, or time cap for "for time". */
  minutes: number
  /** Rounds for "for time" and Tabata. */
  rounds: number
  items: string[]
  builtin: boolean
}

/** One set as done. Chained movements are logged as their own sets, with `chained: true`. */
export interface LoggedSet {
  item_id: string
  exercise_id: string
  index: number
  reps: number
  weight: number | null
  done: boolean
  chained: boolean
}

export type Feeling = 'easy' | 'good' | 'hard'

/** A session that was done. */
export interface TrainingLog {
  id: string
  session_id: string | null
  discipline: Discipline
  name: string
  day: string
  started_at: string
  duration_s: number
  feeling: Feeling | null
  note: string
  warmup_done: boolean
  /** Rounds done per circuit item. */
  circuits: Record<string, number>
  sets: LoggedSet[]
  wod_id: string | null
  wod_result: string
  /** Exercises on which a personal record was beaten. */
  records: string[]
  family_id: string | null
  xp_earned: number
}

export const FEELING_LABELS: Record<Feeling, string> = { easy: 'Facile', good: 'Bien', hard: 'Dur' }
export const WOD_FORMAT_LABELS: Record<WodFormat, string> = { amrap: 'AMRAP', emom: 'EMOM', for_time: 'For time', tabata: 'Tabata' }
export const PLACE_LABELS: Record<Place, string> = { gym: 'Salle', home: 'Maison' }
export const CATEGORY_LABELS: Record<MobilityCategory, string> = {
  mobility: 'Mobilité',
  stretch: 'Étirements',
  physio: 'Exercices de kiné',
  flexibility: 'Souplesse',
}
