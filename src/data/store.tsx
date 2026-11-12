import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { newTask, numberSubtasks, planAfterCompletion, planAvoidCredits, planFixedRecurrences, planReopen } from '../domain/automation'
import { buildSeed, syncCatalog } from '../domain/catalog'
import { habitBadges } from '../domain/fun'
import { clockTime, logicalDay } from '../domain/date'
import { getValidation, indexValidations, isAvoidOk, isAvoidSettled, isDayDone, reachedLevel, routineLevels } from '../domain/schedule'
import { computeStreak, streakDays, type Streak } from '../domain/streak'
import {
  normalizeShape,
  type CalendarEvent,
  type Checklist,
  type Family,
  type Habit,
  type HabitTemplate,
  type Moment,
  type Profile,
  type Slip,
  type Task,
  type TaskList,
  type Validation,
  type XpSettings,
} from '../domain/types'
import { DEFAULT_XP, levelsValidationXp, routineXp, taskXp, validationXp } from '../domain/xp'
import { buildMobility } from '../training/mobility'
import { buildProgram } from '../training/program'
import { badgesXp, computeBadges, type Badge, type TrainingGoal } from '../training/achievements'
import type { DanceClass, DanceFigure, DanceGoal, DanceSession } from '../training/dance'
import type { Exercise, TrainingLog, TrainingSession, Wod } from '../training/types'
import { repo, type Row, type Table } from './repo'

export interface Data {
  families: Family[]
  habit_templates: HabitTemplate[]
  habits: Habit[]
  validations: Validation[]
  slips: Slip[]
  task_lists: TaskList[]
  tasks: Task[]
  checklists: Checklist[]
  events: CalendarEvent[]
  profile: Profile[]
  training_exercises: Exercise[]
  training_sessions: TrainingSession[]
  training_wods: Wod[]
  training_logs: TrainingLog[]
  training_goals: TrainingGoal[]
  dance_classes: DanceClass[]
  dance_sessions: DanceSession[]
  dance_figures: DanceFigure[]
  dance_goals: DanceGoal[]
}

const TABLES: Table[] = [
  'families',
  'habit_templates',
  'habits',
  'validations',
  'slips',
  'task_lists',
  'tasks',
  'checklists',
  'events',
  'profile',
  'training_exercises',
  'training_sessions',
  'training_wods',
  'training_logs',
  'training_goals',
  'dance_classes',
  'dance_sessions',
  'dance_figures',
  'dance_goals',
]

const MIGRATION_MESSAGE =
  "La base Supabase n'est pas à jour : exécutez supabase/migration_v0.2.sql puis supabase/migration_v0.3.sql dans l'éditeur SQL de Supabase, puis rechargez la page."

/** Errors raised when the database lacks a table or a column of this version. */
function isSchemaError(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(err?.code ?? '') || /does not exist|could not find/i.test(err?.message ?? '')
}

/** Rows saved before V0.2 lack its fields. */
function normalize(d: Data): Data {
  return {
    ...d,
    habits: d.habits.map(normalizeShape),
    habit_templates: d.habit_templates.map(normalizeShape),
    validations: d.validations.map((v) => ({ ...v, steps: v.steps ?? [] })),
    tasks: d.tasks.map((t) => ({ ...t, recurrence: t.recurrence ?? null, previous_id: t.previous_id ?? null, checklist_id: t.checklist_id ?? null, position: t.position ?? 0 })),
    profile: d.profile.map((p) => ({ ...p, xp: p.xp ?? null })),
    training_sessions: d.training_sessions.map((s) => ({ ...s, category: s.category ?? '', levels: s.levels ?? [] })),
  }
}

/** What "Annuler" puts back: the state of each row before the action. */
interface UndoEntry {
  label: string
  at: number
  ops: { table: Table; id: string; before: Row | null }[]
}

function useStoreValue() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null)
  // Writes run one after another so that a row always reaches the server after its parents.
  const queue = useRef(Promise.resolve())
  // While an undoable action runs, the rows it touches and their previous state.
  const recorder = useRef<Map<string, UndoEntry['ops'][number]> | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const enqueue = (write: () => Promise<void>) => {
    queue.current = queue.current.then(write).catch((e) => {
      setError(isSchemaError(e) ? MIGRATION_MESSAGE : "Une modification n'a pas pu être enregistrée. Rechargez la page.")
    })
  }

  const record = (table: Table, id: string) => {
    const key = `${table}|${id}`
    if (!recorder.current || recorder.current.has(key) || !data) return
    const before = (data[table] as Row[]).find((r) => r.id === id) ?? null
    recorder.current.set(key, { table, id, before })
  }

  const save = <K extends Table>(table: K, row: Data[K][number]) => {
    record(table, row.id)
    setData((d) => {
      if (!d) return d
      const rows = d[table] as Row[]
      // An updated row keeps its place, so that lists do not reorder when an item is checked.
      const next = rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row]
      return { ...d, [table]: next }
    })
    enqueue(() => repo.upsert(table, row))
  }

  const remove = (table: Table, id: string) => {
    record(table, id)
    setData((d) => d && { ...d, [table]: (d[table] as Row[]).filter((r) => r.id !== id) })
    enqueue(() => repo.remove(table, id))
  }

  /** Runs an action and offers to undo it for a few seconds. */
  const track = (label: string, action: () => void) => {
    recorder.current = new Map()
    try {
      action()
    } finally {
      const ops = [...recorder.current.values()]
      recorder.current = null
      if (ops.length > 0) setUndoEntry({ label, at: Date.now(), ops })
    }
  }

  const undo = () => {
    if (!undoEntry) return
    for (const op of [...undoEntry.ops].reverse()) {
      if (op.before) save(op.table, op.before as never)
      else remove(op.table, op.id)
    }
    setUndoEntry(null)
  }

  // React's StrictMode runs effects twice; the first-run seed must only happen once.
  const loadStarted = useRef(false)

  useEffect(() => {
    if (loadStarted.current) return
    loadStarted.current = true
    async function load() {
      const rows = await Promise.all(TABLES.map((t) => repo.list(t)))
      const loaded = normalize(Object.fromEntries(TABLES.map((t, i) => [t, rows[i]])) as unknown as Data)
      if (loaded.profile.length === 0) {
        const seed = buildSeed()
        const profile: Profile = { id: crypto.randomUUID(), day_rollover_hour: 4, xp: null }
        for (const f of seed.families) await repo.upsert('families', f)
        for (const t of seed.habit_templates) await repo.upsert('habit_templates', t)
        for (const l of seed.task_lists) await repo.upsert('task_lists', l)
        for (const c of seed.checklists) await repo.upsert('checklists', c)
        await repo.upsert('profile', profile)
        Object.assign(loaded, seed, { profile: [profile] })
      }
      // The gym program and the finisher library, loaded once when the training tables are empty.
      if (loaded.training_exercises.length === 0 && loaded.training_sessions.length === 0) {
        const program = buildProgram()
        for (const e of program.exercises) await repo.upsert('training_exercises', e)
        for (const s of program.sessions) await repo.upsert('training_sessions', s)
        for (const w of program.wods) await repo.upsert('training_wods', w)
        Object.assign(loaded, { training_exercises: program.exercises, training_sessions: program.sessions, training_wods: program.wods })
      }
      // Starter mobility routines, once, when there is no mobility routine and no mobility session yet.
      if (!loaded.training_sessions.some((s) => s.discipline === 'mobility') && !loaded.training_logs.some((l) => l.discipline === 'mobility')) {
        const mobility = buildMobility()
        for (const e of mobility.exercises) await repo.upsert('training_exercises', e)
        for (const s of mobility.sessions) await repo.upsert('training_sessions', s)
        loaded.training_exercises = [...loaded.training_exercises, ...mobility.exercises]
        loaded.training_sessions = [...loaded.training_sessions, ...mobility.sessions]
      }
      // Rows from earlier versions: sub-task positions, and the built-in templates of the current catalogue.
      for (const t of numberSubtasks(loaded.tasks)) {
        await repo.upsert('tasks', t)
        loaded.tasks = loaded.tasks.map((x) => (x.id === t.id ? t : x))
      }
      for (const t of syncCatalog(loaded.families, loaded.habit_templates)) {
        await repo.upsert('habit_templates', t)
        loaded.habit_templates = [...loaded.habit_templates.filter((x) => x.id !== t.id), t]
      }
      setData(loaded)
    }
    load().catch((e) => setError(isSchemaError(e) ? MIGRATION_MESSAGE : 'Impossible de charger vos données.'))
  }, [])

  const today = data ? logicalDay(now, data.profile[0].day_rollover_hour) : ''
  const xp: XpSettings = { ...DEFAULT_XP, ...(data?.profile[0].xp ?? {}) }

  const streakDaysBefore = (habit: Habit, day: string) => {
    const others = indexValidations(data!.validations.filter((v) => v.day !== day))
    const streak = computeStreak(habit, others, day)
    return streakDays(streak) + (streak.unit === 'days' ? 1 : 0)
  }

  const findValidation = (habit: Habit, day: string, moment: Moment) => getValidation(indexValidations(data!.validations), habit.id, day, moment)

  /** Simple, duration, quantity and levels habits. For levels, the value is the level reached. */
  const writeValidation = (habit: Habit, day: string, moment: Moment, value: number) => {
    const existing = findValidation(habit, day, moment)
    if (value <= 0) {
      if (existing) remove('validations', existing.id)
      return
    }
    const bonusDays = streakDaysBefore(habit, day)
    save('validations', {
      id: existing?.id ?? crypto.randomUUID(),
      habit_id: habit.id,
      day,
      moment,
      value,
      steps: [],
      xp_earned: habit.tracking === 'levels' ? levelsValidationXp(value, bonusDays, xp) : validationXp(value, habit.goal, bonusDays, xp),
    } satisfies Validation)
  }

  const writeRoutineSteps = (habit: Habit, day: string, moment: Moment, steps: string[]) => {
    const existing = findValidation(habit, day, moment)
    if (steps.length === 0) {
      if (existing) remove('validations', existing.id)
      return
    }
    const level = reachedLevel(habit, steps)
    save('validations', {
      id: existing?.id ?? crypto.randomUUID(),
      habit_id: habit.id,
      day,
      moment,
      value: level,
      steps,
      xp_earned: routineXp(steps.length, level, streakDaysBefore(habit, day), xp),
    } satisfies Validation)
  }

  const avoidValidation = (habit: Habit, day: string): Validation => ({
    id: crypto.randomUUID(),
    habit_id: habit.id,
    day,
    moment: habit.moments[0] ?? 'day',
    value: 1,
    steps: [],
    xp_earned: validationXp(1, 1, streakDaysBefore(habit, day), xp),
  })

  /** One check mark: validates a moment fully (lightest level, whole routine, "tenu"), or cancels it. */
  const toggleMomentRaw = (habit: Habit, day: string, moment: Moment) => {
    const existing = findValidation(habit, day, moment)
    const done = (existing?.value ?? 0) >= habit.goal
    if (habit.tracking === 'routine') {
      const levels = routineLevels(habit)
      writeRoutineSteps(habit, day, moment, done ? [] : levels[levels.length - 1].steps)
    } else if (habit.tracking === 'avoid') {
      if (!done && isAvoidOk(habit, data!.slips, day)) save('validations', avoidValidation(habit, day))
      else if (done && existing && !isAvoidSettled(habit, day, today, clockTime(now))) remove('validations', existing.id)
    } else {
      writeValidation(habit, day, moment, done ? 0 : habit.tracking === 'levels' ? 1 : habit.goal)
    }
  }

  const label = (habit: Habit, undone: boolean) => `${habit.name} : ${undone ? 'annulé' : 'validé'}`

  const toggleMoment = (habit: Habit, day: string, moment: Moment) => {
    const done = (findValidation(habit, day, moment)?.value ?? 0) >= habit.goal
    track(label(habit, done), () => toggleMomentRaw(habit, day, moment))
  }

  /** The whole day at once (all moments), as in the agenda. */
  const toggleDay = (habit: Habit, day: string) => {
    if (!data) return
    const done = isDayDone(habit, indexValidations(data.validations), day)
    track(label(habit, done), () =>
      habit.moments.forEach((m) => {
        const momentDone = (findValidation(habit, day, m)?.value ?? 0) >= habit.goal
        if (momentDone === done) toggleMomentRaw(habit, day, m)
      }),
    )
  }

  const setValidation = (habit: Habit, day: string, moment: Moment, value: number) =>
    track(`${habit.name} : ${value > 0 ? 'enregistré' : 'annulé'}`, () => writeValidation(habit, day, moment, value))

  const setRoutineSteps = (habit: Habit, day: string, moment: Moment, steps: string[]) =>
    track(`${habit.name} : étapes mises à jour`, () => writeRoutineSteps(habit, day, moment, steps))

  /** Today's slips take the current time; slips noted on a past day always count. */
  const addSlip = (habit: Habit, day: string) => {
    const time = day === today ? clockTime(now) : habit.avoid?.after ? '23:59' : '00:00'
    track(`${habit.name} : écart noté`, () => save('slips', { id: crypto.randomUUID(), habit_id: habit.id, day, time } satisfies Slip))
  }

  const removeSlip = (habit: Habit, day: string) => {
    const last = data?.slips.filter((s) => s.habit_id === habit.id && s.day === day).sort((a, b) => a.time.localeCompare(b.time)).pop()
    if (last) track(`${habit.name} : écart retiré`, () => remove('slips', last.id))
  }

  /** Deletes a habit with its whole history. Not undoable: the page asks for confirmation. */
  const removeHabit = (habit: Habit) => {
    setData((d) => d && { ...d, validations: d.validations.filter((v) => v.habit_id !== habit.id), slips: d.slips.filter((s) => s.habit_id !== habit.id) })
    enqueue(() => repo.removeWhere('validations', 'habit_id', habit.id))
    enqueue(() => repo.removeWhere('slips', 'habit_id', habit.id))
    remove('habits', habit.id)
    setUndoEntry(null)
  }

  const completeTop = (task: Task) => planAfterCompletion(task, data!.tasks, today).forEach((t) => save('tasks', t))

  /** Re-opening a task removes the next occurrence it created, if that one is untouched. */
  const reopenTop = (task: Task) => {
    const plan = planReopen(task, data!.tasks)
    if (!plan) return
    plan.remove.forEach((t) => remove('tasks', t.id))
    save('tasks', { ...plan.restore, completed_at: null, xp_earned: 0 })
  }

  const toggleTask = (task: Task) => {
    if (!data) return
    const completing = task.completed_at === null
    track(`${task.title} : ${completing ? 'terminée' : 'rouverte'}`, () => {
      const updated: Task = {
        ...task,
        completed_at: completing ? new Date().toISOString() : null,
        xp_earned: completing ? (task.parent_id ? xp.subtask : taskXp(task.priority, xp)) : 0,
      }
      save('tasks', updated)
      if (!task.parent_id) {
        if (completing) completeTop(updated)
        else reopenTop(updated)
        return
      }
      const parent = data.tasks.find((t) => t.id === task.parent_id)
      if (!parent) return
      const siblings = data.tasks.filter((t) => t.parent_id === parent.id).map((t) => (t.id === task.id ? updated : t))
      const allDone = siblings.every((t) => t.completed_at !== null)
      if (allDone === (parent.completed_at !== null)) return
      const block: Task = { ...parent, completed_at: allDone ? new Date().toISOString() : null, xp_earned: allDone ? xp.block_bonus : 0 }
      save('tasks', block)
      if (allDone) completeTop(block)
      else reopenTop(block)
    })
  }

  const removeTask = (task: Task) =>
    track(`${task.title} : supprimée`, () => {
      data?.tasks.filter((t) => t.parent_id === task.id).forEach((t) => remove('tasks', t.id))
      remove('tasks', task.id)
    })

  const launchChecklist = (checklist: Checklist, due: string | null) =>
    track(`${checklist.name} : lancée`, () => {
      const block = newTask({
        title: checklist.name,
        list_id: checklist.list_id,
        due_date: due ?? (checklist.recurrence ? today : null),
        recurrence: checklist.recurrence,
        checklist_id: checklist.id,
      })
      save('tasks', block)
      checklist.items.forEach((item, position) => save('tasks', newTask({ title: item, parent_id: block.id, list_id: checklist.list_id, position })))
    })

  /** Detach rows that may still point at a deleted family or list (archived habits, tasks). */
  const removeFamily = (family: Family) => {
    data?.habits.filter((h) => h.family_id === family.id).forEach((h) => save('habits', { ...h, family_id: null }))
    remove('families', family.id)
  }

  const removeList = (list: TaskList) => {
    data?.tasks.filter((t) => t.parent_id === null && t.list_id === list.id).forEach((t) => save('tasks', { ...t, list_id: null }))
    data?.checklists.filter((c) => c.list_id === list.id).forEach((c) => save('checklists', { ...c, list_id: null }))
    remove('task_lists', list.id)
  }

  // Rows written by the automatic pass below, so that StrictMode's double effects never write them twice.
  const handled = useRef(new Set<string>())

  /** Automatic bookkeeping: credit avoid habits whose day is over, and bring back fixed recurring tasks. */
  useEffect(() => {
    if (!data) return
    const plan = planAvoidCredits(data.habits, indexValidations(data.validations), data.slips, today, clockTime(now))
    plan.drop.forEach((id) => remove('validations', id))
    for (const { habit, day, key } of plan.credit) {
      if (handled.current.has(key)) continue
      handled.current.add(key)
      save('validations', avoidValidation(habit, day))
    }
    for (const { head, rows } of planFixedRecurrences(data.tasks, today)) {
      if (handled.current.has(head.id)) continue
      handled.current.add(head.id)
      rows.forEach((t) => save('tasks', t))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, today, now])

  return {
    data,
    error,
    today,
    now,
    xp,
    undoEntry,
    undo,
    dismissUndo: () => setUndoEntry(null),
    track,
    save,
    remove,
    setValidation,
    setRoutineSteps,
    toggleMoment,
    toggleDay,
    addSlip,
    removeSlip,
    removeHabit,
    toggleTask,
    removeTask,
    launchChecklist,
    removeFamily,
    removeList,
  }
}

type StoreValue = ReturnType<typeof useStoreValue>
const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreValue()
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store || !store.data) throw new Error('Store not ready')
  return { ...store, data: store.data }
}

export function useStoreStatus() {
  const store = useContext(StoreContext)!
  return { ready: store.data !== null, error: store.error }
}

export function useToday() {
  return useStore().today
}

export function useValidationIndex() {
  const { data } = useStore()
  return useMemo(() => indexValidations(data.validations), [data.validations])
}

/** Streaks of every habit, computed once per change instead of once per row. */
export function useStreaks(): Map<string, Streak> {
  const { data, today } = useStore()
  const index = useValidationIndex()
  return useMemo(() => new Map(data.habits.map((h) => [h.id, computeStreak(h, index, today)])), [data.habits, index, today])
}

/** All badges (habits, tasks and training), recomputed when the data they read change. */
export function useBadges(): Badge[] {
  const { data, today } = useStore()
  const index = useValidationIndex()
  return useMemo(
    () => [...habitBadges(data, index, today).map((b) => ({ ...b, group: 'habits' as const })), ...computeBadges(data)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.habits, index, data.tasks, today, data.training_logs, data.training_exercises, data.training_goals, data.dance_sessions, data.dance_figures, data.dance_goals],
  )
}

export function useTotalXp() {
  const { data } = useStore()
  const badges = useBadges()
  return (
    data.validations.reduce((s, v) => s + v.xp_earned, 0) +
    data.tasks.reduce((s, t) => s + t.xp_earned, 0) +
    data.training_logs.reduce((s, l) => s + l.xp_earned, 0) +
    data.dance_sessions.reduce((s, d) => s + d.xp_earned, 0) +
    data.dance_figures.reduce((s, f) => s + f.xp_earned, 0) +
    data.dance_goals.reduce((s, g) => s + g.xp_earned, 0) +
    data.training_goals.reduce((s, g) => s + g.xp_earned, 0) +
    badgesXp(badges)
  )
}

export function useUndo() {
  const store = useContext(StoreContext)!
  return { entry: store.undoEntry, undo: store.undo, dismiss: store.dismissUndo }
}
