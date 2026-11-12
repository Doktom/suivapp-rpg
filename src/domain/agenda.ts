import { addDays, mondayOf } from './date'
import { isActiveOn, isAvoidOk, isDayDone, isDueOn, isQuota, periodDoneCount, quotaCount, type ValidationIndex } from './schedule'
import { classesOn, KIND_LABELS as DANCE_KIND_LABELS, STYLE_COLORS, STYLE_LABELS, type DanceClass, type DanceSession } from '../training/dance'
import type { Streak } from './streak'
import { MOMENT_LABELS, type CalendarEvent, type Family, type Habit, type Moment, type Slip, type Task } from './types'

export type ItemKind = 'habit' | 'task' | 'event' | 'training'
export type ItemState = 'done' | 'todo' | 'missed' | 'grace' | 'late'

export interface AgendaItem {
  key: string
  kind: ItemKind
  /** Id of the habit, task or event. */
  refId: string
  title: string
  /** 'HH:MM', or a moment name when there is no time. */
  when: string
  /** Sort key: times first, then morning / day / evening, then the rest. */
  order: string
  state: ItemState
  color: string
  /** Habits: the moment of the day they belong to. */
  moment?: Moment
  event?: CalendarEvent
}

export interface AgendaFilters {
  kinds: Record<ItemKind, boolean>
  familyId: string
  listId: string
}

export interface AgendaSource {
  habits: Habit[]
  tasks: Task[]
  events: CalendarEvent[]
  families: Family[]
  slips: Slip[]
  training_logs: { id: string; name: string; day: string; started_at: string; duration_s: number; discipline: string }[]
  dance_classes: DanceClass[]
  dance_sessions: DanceSession[]
}

const MOMENT_ORDER = { morning: '1', day: '2', evening: '3' } as const

export function agendaItems(
  src: AgendaSource,
  day: string,
  today: string,
  index: ValidationIndex,
  streaks: Map<string, Streak>,
  filters: AgendaFilters,
): AgendaItem[] {
  const items: AgendaItem[] = []
  if (filters.kinds.event && !filters.familyId && !filters.listId) {
    for (const e of src.events.filter((e) => e.day === day)) {
      items.push({
        key: `e-${e.id}`,
        refId: e.id,
        kind: 'event',
        title: e.title,
        when: e.start_time ? `${e.start_time}${e.end_time ? `–${e.end_time}` : ''}` : 'Journée',
        order: e.start_time ? `0${e.start_time}` : '00',
        state: 'todo',
        color: e.color,
        event: e,
      })
    }
  }
  if (filters.kinds.training && !filters.familyId && !filters.listId) {
    for (const l of src.training_logs.filter((l) => l.day === day)) {
      const start = new Date(l.started_at)
      const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
      items.push({
        key: `s-${l.id}`,
        refId: l.id,
        kind: 'training',
        title: `${l.name} · ${Math.round(l.duration_s / 60)} min`,
        when: time,
        order: `0${time}`,
        state: 'done',
        color: l.discipline === 'mobility' ? '#8B5CF6' : '#FF6B3D',
      })
    }
  }
  if (filters.kinds.training && !filters.familyId && !filters.listId) {
    const sessions = src.dance_sessions.filter((s) => s.day === day && s.status !== 'skipped')
    for (const c of classesOn(src.dance_classes, day)) {
      const attended = sessions.some((s) => s.class_id === c.id && s.status === 'done')
      items.push({
        key: `dc-${c.id}`,
        refId: c.id,
        kind: 'training',
        title: `Cours de ${STYLE_LABELS[c.style].toLowerCase()}`,
        when: `${c.start_time}–${c.end_time}`,
        order: `0${c.start_time}`,
        state: attended ? 'done' : day < today ? 'missed' : 'todo',
        color: STYLE_COLORS[c.style],
      })
    }
    for (const s of sessions.filter((s) => !s.class_id)) {
      items.push({
        key: `ds-${s.id}`,
        refId: s.id,
        kind: 'training',
        title: s.title || `${DANCE_KIND_LABELS[s.kind]} · ${STYLE_LABELS[s.style]}`,
        when: s.start_time ?? 'Journée',
        order: s.start_time ? `0${s.start_time}` : '00',
        state: s.status === 'done' ? 'done' : day < today ? 'missed' : 'todo',
        color: STYLE_COLORS[s.style],
      })
    }
  }
  if (filters.kinds.habit && !filters.listId) {
    for (const h of src.habits) {
      if (isQuota(h) || (filters.familyId && h.family_id !== filters.familyId) || !isDueOn(h, index, day)) continue
      const done = isDayDone(h, index, day)
      // An avoid habit is lost as soon as its tolerance is exceeded, even before the day ends.
      const lost = h.tracking === 'avoid' && !isAvoidOk(h, src.slips, day)
      const grace = streaks.get(h.id)?.graceDays.has(day) ?? false
      const moment = h.moments[0] ?? 'day'
      items.push({
        key: `h-${h.id}`,
        refId: h.id,
        kind: 'habit',
        title: h.name,
        when: h.time_of_day ?? h.moments.map((m) => MOMENT_LABELS[m]).join(', '),
        order: h.time_of_day ? `0${h.time_of_day}` : MOMENT_ORDER[moment],
        state: done ? 'done' : lost ? 'missed' : day >= today ? 'todo' : grace ? 'grace' : 'missed',
        color: src.families.find((f) => f.id === h.family_id)?.color ?? '#9aa39a',
        moment,
      })
    }
  }
  if (filters.kinds.task && !filters.familyId) {
    for (const t of src.tasks) {
      if (t.parent_id || t.due_date !== day || (filters.listId && t.list_id !== filters.listId)) continue
      items.push({
        key: `t-${t.id}`,
        refId: t.id,
        kind: 'task',
        title: t.title,
        when: 'Tâche',
        order: '4',
        state: t.completed_at ? 'done' : day < today ? 'late' : 'todo',
        color: '#596159',
      })
    }
  }
  return items.sort((a, b) => a.order.localeCompare(b.order) || a.title.localeCompare(b.title))
}

export interface QuotaLine {
  habit: Habit
  done: number
  quota: number
  monthly: boolean
}

/** Habits without a fixed day, for the "this week" band. */
export function quotaLines(habits: Habit[], weekDay: string, index: ValidationIndex, familyId: string): QuotaLine[] {
  const monday = mondayOf(weekDay)
  return habits
    .filter((h) => isQuota(h) && !h.archived && (!familyId || h.family_id === familyId))
    .filter((h) => Array.from({ length: 7 }, (_, i) => addDays(monday, i)).some((d) => isActiveOn(h, d)))
    .map((h) => ({ habit: h, done: periodDoneCount(h, index, weekDay), quota: quotaCount(h), monthly: h.frequency.type === 'per_month' }))
}
