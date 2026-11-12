/** Dance: weekly classes, socials and practice, figures learned, and personal goals with the means to reach them. */
import { addDays, mondayOf, weekday } from '../domain/date'

export type DanceStyle = 'salsa' | 'bachata' | 'kizomba'
export type DanceKind = 'class' | 'social' | 'practice'
export type FigureStatus = 'to_learn' | 'learning' | 'mastered'

export const STYLES: DanceStyle[] = ['salsa', 'bachata', 'kizomba']
export const STYLE_LABELS: Record<DanceStyle, string> = { salsa: 'Salsa', bachata: 'Bachata', kizomba: 'Kizomba' }
/** Style colors, for marks only (text stays in ink). */
export const STYLE_COLORS: Record<DanceStyle, string> = { salsa: '#C0533A', bachata: '#A64D79', kizomba: '#4A63A0' }
export const KIND_LABELS: Record<DanceKind, string> = { class: 'Cours', social: 'Soirée', practice: 'Pratique perso' }
export const FIGURE_LABELS: Record<FigureStatus, string> = { to_learn: 'À apprendre', learning: 'En cours', mastered: 'Maîtrisée' }

/** A class at a fixed time every week. */
export interface DanceClass {
  id: string
  style: DanceStyle
  /** 0 = Monday. */
  weekday: number
  start_time: string
  end_time: string
  place: string
  level: string
  active: boolean
}

/** A class attended, a social night (planned or done), or personal practice. */
export interface DanceSession {
  id: string
  style: DanceStyle
  kind: DanceKind
  day: string
  start_time: string | null
  duration_min: number
  /** Socials can be planned ahead; classes and practice are logged as done. */
  status: 'planned' | 'done' | 'skipped'
  class_id: string | null
  title: string
  note: string
  figure_ids: string[]
  family_id: string | null
  xp_earned: number
}

export interface DanceFigure {
  id: string
  style: DanceStyle
  name: string
  status: FigureStatus
  notes: string
  /** Day it was mastered. */
  mastered_on: string | null
  xp_earned: number
}

/** What the goal's gauge counts. */
export type GoalMeasure = 'figures' | 'socials' | 'hours' | 'means'

/** A concrete action that helps reach a goal. */
export interface GoalMean {
  id: string
  text: string
  done: boolean
}

export interface DanceGoal {
  id: string
  title: string
  /** '' for all styles. */
  style: DanceStyle | ''
  measure: GoalMeasure
  target: number
  start_day: string
  due_day: string | null
  means: GoalMean[]
  achieved_on: string | null
  xp_earned: number
}

export const GOAL_MEASURE_LABELS: Record<GoalMeasure, string> = {
  figures: 'Figures maîtrisées',
  socials: 'Soirées',
  hours: 'Heures de danse',
  means: 'Actions cochées',
}

export const DANCE_XP = { class: 20, social: 25, practicePer10Min: 2, practiceMax: 20, figure: 15, goal: 50 }

export function sessionXp(kind: DanceKind, minutes: number): number {
  if (kind === 'class') return DANCE_XP.class
  if (kind === 'social') return DANCE_XP.social
  return Math.min(DANCE_XP.practiceMax, Math.max(DANCE_XP.practicePer10Min, Math.round(minutes / 10) * DANCE_XP.practicePer10Min))
}

export function minutesBetween(start: string, end: string): number {
  const [h1, m1] = start.split(':').map(Number)
  const [h2, m2] = end.split(':').map(Number)
  const diff = h2 * 60 + m2 - (h1 * 60 + m1)
  return diff > 0 ? diff : diff + 24 * 60
}

export interface WeekClass {
  danceClass: DanceClass
  day: string
  session: DanceSession | null
  state: 'done' | 'todo' | 'missed'
}

/** This week's fixed classes, with whether each was attended. */
export function weekClasses(classes: DanceClass[], sessions: DanceSession[], anyDay: string, today: string): WeekClass[] {
  const monday = mondayOf(anyDay)
  return classes
    .filter((c) => c.active)
    .map((c) => {
      const day = addDays(monday, c.weekday)
      const session = sessions.find((s) => s.class_id === c.id && s.day === day && s.status === 'done') ?? null
      return { danceClass: c, day, session, state: session ? ('done' as const) : day < today ? ('missed' as const) : ('todo' as const) }
    })
    .sort((a, b) => a.day.localeCompare(b.day) || a.danceClass.start_time.localeCompare(b.danceClass.start_time))
}

/** Classes held on a given day (for the agenda). */
export function classesOn(classes: DanceClass[], day: string): DanceClass[] {
  return classes.filter((c) => c.active && c.weekday === weekday(day))
}

/** Minutes danced per style between two days (inclusive), done sessions only. */
export function minutesByStyle(sessions: DanceSession[], from: string, to: string): Record<DanceStyle, number> {
  const out: Record<DanceStyle, number> = { salsa: 0, bachata: 0, kizomba: 0 }
  for (const s of sessions) if (s.status === 'done' && s.day >= from && s.day <= to) out[s.style] += s.duration_min
  return out
}

/** Where a goal stands: counted since it started, in its style (or all). */
export function goalProgress(goal: DanceGoal, sessions: DanceSession[], figures: DanceFigure[]): { value: number; target: number; ratio: number } {
  const inStyle = <T extends { style: DanceStyle }>(x: T) => !goal.style || x.style === goal.style
  let value = 0
  let target = Math.max(1, goal.target)
  if (goal.measure === 'figures') value = figures.filter((f) => inStyle(f) && f.status === 'mastered' && (f.mastered_on ?? '') >= goal.start_day).length
  else if (goal.measure === 'socials') value = sessions.filter((s) => inStyle(s) && s.kind === 'social' && s.status === 'done' && s.day >= goal.start_day).length
  else if (goal.measure === 'hours') value = Math.round((sessions.filter((s) => inStyle(s) && s.status === 'done' && s.day >= goal.start_day).reduce((m, s) => m + s.duration_min, 0) / 60) * 10) / 10
  else {
    value = goal.means.filter((m) => m.done).length
    target = Math.max(1, goal.means.length)
  }
  return { value, target, ratio: Math.min(1, value / target) }
}

/** "1 h 30", "45 min". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m} min`
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}
