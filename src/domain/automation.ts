/**
 * Bookkeeping the app does on its own, written as pure functions so that it can be tested:
 * crediting "avoid" habits once their day is over, and bringing back recurring tasks.
 */
import { addDays } from './date'
import { fixedOccurrences, nextDate } from './recurrence'
import { getValidation, isActiveOn, isAvoidOk, isAvoidSettled, isScheduledDay, type ValidationIndex } from './schedule'
import type { Habit, Recurrence, Slip, Task } from './types'

/** How far back unsettled "avoid" days are credited. */
export const AVOID_LOOKBACK_DAYS = 30

export interface AvoidPlan {
  /** Days to credit, as `habitId|day` keys. */
  credit: { habit: Habit; day: string; key: string }[]
  /** Validations to drop because a slip broke the tolerance. */
  drop: string[]
}

export function planAvoidCredits(habits: Habit[], index: ValidationIndex, slips: Slip[], today: string, now: string): AvoidPlan {
  const plan: AvoidPlan = { credit: [], drop: [] }
  const earliest = addDays(today, -AVOID_LOOKBACK_DAYS)
  for (const habit of habits) {
    if (habit.tracking !== 'avoid' || habit.archived) continue
    const moment = habit.moments[0] ?? 'day'
    const from = habit.start_date > earliest ? habit.start_date : earliest
    for (let day = from; day <= today; day = addDays(day, 1)) {
      if (!isActiveOn(habit, day) || !isScheduledDay(habit, day)) continue
      const existing = getValidation(index, habit.id, day, moment)
      const ok = isAvoidOk(habit, slips, day)
      if (!ok && existing) plan.drop.push(existing.id)
      else if (ok && !existing && isAvoidSettled(habit, day, today, now)) plan.credit.push({ habit, day, key: `${habit.id}|${day}` })
    }
  }
  return plan
}

export const newTask = (fields: Partial<Task> & Pick<Task, 'title'>): Task => ({
  id: crypto.randomUUID(),
  list_id: null,
  parent_id: null,
  note: '',
  due_date: null,
  priority: 'normal',
  recurrence: null,
  previous_id: null,
  checklist_id: null,
  position: 0,
  completed_at: null,
  xp_earned: 0,
  ...fields,
})

/** A new occurrence of a task, with fresh copies of its sub-tasks. */
export function buildOccurrence(task: Task, due: string, recurrence: Recurrence | null, children: Task[]): Task[] {
  const copy = newTask({ ...task, id: crypto.randomUUID(), due_date: due, recurrence, previous_id: task.id, completed_at: null, xp_earned: 0 })
  const kids = children.map((c) => newTask({ ...c, id: crypto.randomUUID(), parent_id: copy.id, completed_at: null, xp_earned: 0 }))
  return [copy, ...kids]
}

/** Sub-tasks of a block, in their fixed order. */
export const childrenOf = (tasks: Task[], id: string) =>
  tasks.filter((t) => t.parent_id === id).sort((a, b) => a.position - b.position)

/** Sub-tasks saved before positions existed: number them in their current order (only blocks that need it). */
export function numberSubtasks(tasks: Task[]): Task[] {
  const updates: Task[] = []
  for (const parentId of new Set(tasks.filter((t) => t.parent_id).map((t) => t.parent_id!))) {
    const kids = tasks.filter((t) => t.parent_id === parentId)
    if (new Set(kids.map((k) => k.position)).size === kids.length) continue
    kids.forEach((k, position) => updates.push({ ...k, position }))
  }
  return updates
}

/** Fixed-schedule tasks that are due: rows to save (the old occurrence without its recurrence, then the new ones). */
export function planFixedRecurrences(tasks: Task[], today: string): { head: Task; rows: Task[] }[] {
  const plans: { head: Task; rows: Task[] }[] = []
  for (const task of tasks) {
    const r = task.recurrence
    if (!r || r.mode !== 'fixed' || task.parent_id || !task.due_date || task.due_date > today) continue
    const children = childrenOf(tasks, task.id)
    const rows: Task[] = [{ ...task, recurrence: null }]
    let previous = task
    const dates = fixedOccurrences(task.due_date, r, today)
    dates.forEach((due, i) => {
      const occurrence = buildOccurrence(previous, due, i === dates.length - 1 ? r : null, children)
      rows.push(...occurrence)
      previous = occurrence[0]
    })
    plans.push({ head: task, rows })
  }
  return plans
}

/** "After completion" tasks: once done, the next occurrence comes N units after today. */
export function planAfterCompletion(task: Task, tasks: Task[], today: string): Task[] {
  if (task.parent_id || task.recurrence?.mode !== 'after') return []
  return [{ ...task, recurrence: null }, ...buildOccurrence(task, nextDate(today, task.recurrence), task.recurrence, childrenOf(tasks, task.id))]
}

/**
 * Re-opening a task that already produced its next occurrence: if that occurrence is still untouched,
 * it is removed and the recurrence goes back to the re-opened task.
 */
export function planReopen(task: Task, tasks: Task[]): { remove: Task[]; restore: Task } | null {
  const next = tasks.find((t) => t.previous_id === task.id && t.recurrence?.mode === 'after')
  if (!next || next.completed_at) return null
  const kids = childrenOf(tasks, next.id)
  if (kids.some((k) => k.completed_at)) return null
  return { remove: [...kids, next], restore: { ...task, recurrence: next.recurrence } }
}
