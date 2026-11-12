export type Tracking = 'simple' | 'duration' | 'quantity' | 'levels' | 'routine' | 'avoid'
export type Moment = 'morning' | 'day' | 'evening'
export type Priority = 'low' | 'normal' | 'high'

export type Frequency =
  | { type: 'daily' }
  /** Weekdays are numbered from 0 (Monday) to 6 (Sunday). */
  | { type: 'weekdays'; days: number[] }
  | { type: 'per_week'; count: number }
  | { type: 'per_month'; count: number }
  /** Every `interval` days, counted from the start date. */
  | { type: 'every_n'; interval: number }

export interface Pause {
  from: string
  to: string | null
}

export interface Family {
  id: string
  name: string
  color: string
  stat_name: string
  position: number
}

/** One way of doing a habit, from the lightest to the most complete. */
export interface Level {
  name: string
  detail: string
  /** For routines: the ids of the steps this level contains. */
  steps: string[]
}

export interface Step {
  id: string
  name: string
}

/** Settings of an "avoid" habit. Times are 'HH:MM'. */
export interface Avoid {
  /** Slips only matter before this time ("ne pas fumer avant 12 h"). */
  before: string | null
  /** Slips only matter after this time ("pas d'écran après 22 h"). */
  after: string | null
  /** Number of slips allowed per period before the day is missed. */
  tolerance: number
  period: 'day' | 'week'
}

export interface HabitShape {
  family_id: string | null
  name: string
  tracking: Tracking
  goal: number
  unit: string
  frequency: Frequency
  moments: Moment[]
  levels: Level[]
  steps: Step[]
  avoid: Avoid | null
}

export interface HabitTemplate extends HabitShape {
  id: string
  builtin: boolean
}

export interface Habit extends HabitShape {
  id: string
  description: string
  time_of_day: string | null
  start_date: string
  end_date: string | null
  pauses: Pause[]
  archived: boolean
}

export interface Validation {
  id: string
  habit_id: string
  day: string
  moment: Moment
  /** Amount for duration / quantity, level reached for levels and routines, 1 otherwise. */
  value: number
  /** Routine steps done. */
  steps: string[]
  xp_earned: number
}

/** A slip noted on an "avoid" habit. */
export interface Slip {
  id: string
  habit_id: string
  day: string
  time: string
}

export interface TaskList {
  id: string
  name: string
  color: string
}

export interface Recurrence {
  /** 'fixed': comes back on schedule even if not done; 'after': comes back N units after being done. */
  mode: 'fixed' | 'after'
  interval: number
  unit: 'day' | 'week' | 'month'
}

export interface Task {
  id: string
  list_id: string | null
  parent_id: string | null
  title: string
  note: string
  due_date: string | null
  priority: Priority
  /** Only the latest occurrence of a recurring task carries its recurrence. */
  recurrence: Recurrence | null
  /** The occurrence this one was created from, for recurring tasks. */
  previous_id: string | null
  /** The checklist this block was launched from. */
  checklist_id: string | null
  /** Order of a sub-task within its block. */
  position: number
  completed_at: string | null
  xp_earned: number
}

/** A reusable block of tasks: each launch creates a new block. */
export interface Checklist {
  id: string
  name: string
  items: string[]
  list_id: string | null
  recurrence: Recurrence | null
}

export interface CalendarEvent {
  id: string
  title: string
  day: string
  start_time: string | null
  end_time: string | null
  note: string
  color: string
}

/** XP values, adjustable in the settings. They apply to validations made after a change. */
export interface XpSettings {
  habit: number
  level_step: number
  routine_step: number
  task_low: number
  task_normal: number
  task_high: number
  subtask: number
  block_bonus: number
  streak_bonus: boolean
}

export interface Profile {
  id: string
  day_rollover_hour: number
  xp: XpSettings | null
}

export const MOMENTS: Moment[] = ['morning', 'day', 'evening']
export const MOMENT_LABELS: Record<Moment, string> = { morning: 'Matin', day: 'Journée', evening: 'Soir' }

export const TRACKING_LABELS: Record<Tracking, string> = {
  simple: 'Simple',
  levels: 'Niveaux',
  routine: 'Routine',
  avoid: 'À éviter',
  duration: 'Durée',
  quantity: 'Quantité',
}

export const DEFAULT_LEVELS: Level[] = [
  { name: 'Rapide', detail: '', steps: [] },
  { name: 'Normal', detail: '', steps: [] },
  { name: 'Complet', detail: '', steps: [] },
]

/** Fields added in V0.2: rows saved before it lack them. */
export function normalizeShape<T extends HabitShape>(row: T): T {
  return { ...row, levels: row.levels ?? [], steps: row.steps ?? [], avoid: row.avoid ?? null }
}
