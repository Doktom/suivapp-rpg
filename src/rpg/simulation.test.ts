import { describe, expect, it } from 'vitest'
import { enterSandbox, leaveSandbox, parseMeta, planTransfer, REAL_PREFIX, SIM_PREFIX } from '../data/sandbox'
import { buildSeed } from '../domain/catalog'
import { addDays, mondayOf, weekday } from '../domain/date'
import { DEFAULT_XP } from '../domain/xp'
import type { Habit } from '../domain/types'
import { buildProgram } from '../training/program'
import { ASSIDUITIES, exampleHabits, makeRng, simulate, type SimData } from './simulation'

const habit = (over: Partial<Habit> = {}): Habit =>
  ({
    id: 'h1',
    name: 'Méditation',
    family_id: null,
    tracking: 'simple',
    goal: 1,
    unit: '',
    frequency: { type: 'daily' },
    moments: ['morning'],
    time_of_day: null,
    start_date: '2026-01-01',
    archived: false,
    description: '',
    end_date: null,
    pauses: [],
    levels: [],
    steps: [],
    avoid: null,
    ...over,
  }) as Habit

const empty: SimData = { habits: [], validations: [], slips: [], families: [], training_sessions: [], training_exercises: [], training_logs: [] }
const FROM = '2026-11-02' // a Monday
const TO = addDays(FROM, 56)
const [steady, , chaotic] = ASSIDUITIES
const run = (data: Partial<SimData>, assiduity = ASSIDUITIES[1], seed = 'a') => simulate({ data: { ...empty, ...data }, xp: DEFAULT_XP, from: FROM, to: TO, assiduity, seed })

/** A tiny in-memory localStorage. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    get length() { return map.size },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  }
}

describe('sandbox storage', () => {
  it('reads its meta defensively', () => {
    expect(parseMeta(null)).toEqual({ active: false, offsetDays: 0 })
    expect(parseMeta('oops')).toEqual({ active: false, offsetDays: 0 })
    expect(parseMeta('{"active":true,"offsetDays":12}')).toEqual({ active: true, offsetDays: 12 })
    expect(parseMeta('{"active":true,"offsetDays":"x"}')).toEqual({ active: true, offsetDays: 0 })
    expect(parseMeta('{"active":false,"offsetDays":5}')).toEqual({ active: false, offsetDays: 0 })
  })

  it('copies tables but not device preferences or drafts', () => {
    const plan = planTransfer(['suivapp-rpg:habits', 'suivapp-rpg:theme', 'suivapp-rpg:training-draft', 'suivapp:habits', 'suivapp-rpg-sim:habits'], REAL_PREFIX, SIM_PREFIX)
    expect(plan).toEqual([{ from: 'suivapp-rpg:habits', to: 'suivapp-rpg-sim:habits' }])
  })

  it('never touches the real data, in or out of the sandbox', () => {
    const real = { 'suivapp-rpg:habits': '[{"id":"a"}]', 'suivapp-rpg:theme': 'dark', 'suivapp:habits': '[{"id":"s"}]' }
    const storage = fakeStorage({ ...real, 'suivapp-rpg-sim:habits': '[{"id":"old"}]' })
    enterSandbox(storage)
    expect(storage.getItem('suivapp-rpg-sim:habits')).toBe(real['suivapp-rpg:habits'])
    expect(parseMeta(storage.getItem('suivapp-rpg-meta:sandbox')).active).toBe(true)
    storage.setItem('suivapp-rpg-sim:habits', '[{"id":"played"}]')
    leaveSandbox(storage)
    for (const [k, v] of Object.entries(real)) expect(storage.getItem(k)).toBe(v)
    expect(storage.getItem('suivapp-rpg-sim:habits')).toBeNull()
    expect(storage.getItem('suivapp-rpg-meta:sandbox')).toBeNull()
  })
})

describe('simulation', () => {
  it('is reproducible and never returns the same number twice from different seeds', () => {
    const a = makeRng('x')
    const b = makeRng('x')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(makeRng('y')()).not.toBe(makeRng('x')())
    const r = makeRng('z')
    for (let i = 0; i < 200; i++) expect(r()).toBeGreaterThanOrEqual(0)
  })

  it('plays the same weeks for the same seed', () => {
    const data = { habits: [habit()] }
    const strip = (r: ReturnType<typeof run>) => r.validations.map((v) => `${v.day}${v.moment}${v.xp_earned}`)
    expect(strip(run(data, steady, 's'))).toEqual(strip(run(data, steady, 's')))
  })

  it('does more for a steady hero than for a capricious one', () => {
    const data = { habits: [habit(), habit({ id: 'h2', moments: ['evening'] })] }
    const many = run(data, steady).validations.length
    const few = run(data, chaotic).validations.length
    expect(many).toBeGreaterThan(few)
    expect(many).toBeGreaterThan(56 * 2 * 0.6)
  })

  it('stays inside the period, once per habit, day and moment, and never before a habit starts', () => {
    const late = habit({ id: 'late', start_date: addDays(FROM, 20) })
    const { validations } = run({ habits: [habit(), late] })
    const keys = validations.map((v) => `${v.habit_id}|${v.day}|${v.moment}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const v of validations) {
      expect(v.day >= FROM && v.day < TO).toBe(true)
      expect(v.xp_earned).toBeGreaterThan(0)
    }
    expect(validations.filter((v) => v.habit_id === 'late').every((v) => v.day >= late.start_date)).toBe(true)
  })

  it('skips what is already done and leaves paused days alone', () => {
    const existing = { id: 'e', habit_id: 'h1', day: FROM, moment: 'morning' as const, value: 1, steps: [], xp_earned: 10 }
    expect(run({ habits: [habit()], validations: [existing] }, steady).validations.some((v) => v.day === FROM)).toBe(false)
    const paused = habit({ pauses: [{ from: FROM, to: addDays(FROM, 13) }] })
    expect(run({ habits: [paused] }, steady).validations.every((v) => v.day > addDays(FROM, 13))).toBe(true)
  })

  it('earns the streak bonus once a streak is long enough', () => {
    const { validations } = run({ habits: [habit()] }, steady)
    expect(Math.max(...validations.map((v) => v.xp_earned))).toBeGreaterThan(10)
  })

  it('respects weekly quotas', () => {
    const { validations } = run({ habits: [habit({ frequency: { type: 'per_week', count: 3 } })] }, steady)
    const perWeek = new Map<string, number>()
    for (const v of validations) perWeek.set(mondayOf(v.day), (perWeek.get(mondayOf(v.day)) ?? 0) + 1)
    expect(perWeek.size).toBeGreaterThan(0)
    for (const n of perWeek.values()) expect(n).toBeLessThanOrEqual(3)
  })

  it('holds an avoid habit unless a slip says otherwise', () => {
    const avoid = habit({ id: 'av', tracking: 'avoid', moments: ['day'], avoid: { before: null, after: null, tolerance: 0, period: 'day' } })
    const { validations, slips } = run({ habits: [avoid] }, chaotic)
    expect(slips.length).toBeGreaterThan(0)
    expect(validations.length).toBeGreaterThan(0)
    const slipDays = new Set(slips.map((s) => s.day))
    expect(validations.some((v) => slipDays.has(v.day))).toBe(false)
  })

  it('writes missions with the app xp, and some stay late', () => {
    const { tasks } = run({ habits: [habit()] }, chaotic)
    expect(tasks.length).toBeGreaterThan(5)
    for (const t of tasks) expect(t.completed_at !== null).toBe(t.xp_earned > 0)
    expect(tasks.some((t) => t.completed_at === null)).toBe(true)
  })

  it('logs gym sessions on Monday, Wednesday and Friday, in rotation, with xp', () => {
    const program = buildProgram()
    const { logs } = run({ training_sessions: program.sessions, training_exercises: program.exercises }, steady)
    expect(logs.length).toBeGreaterThan(10)
    for (const l of logs) {
      expect([0, 2, 4]).toContain(weekday(l.day))
      expect(l.xp_earned).toBeGreaterThan(20)
      expect(l.sets.length).toBeGreaterThan(0)
    }
    const sport = program.sessions.filter((s) => s.discipline === 'sport' && s.place === 'gym').sort((a, b) => a.position - b.position)
    if (sport.length > 1) expect(logs[1].session_id).toBe(sport[1].id)
  })

  it('prepares starter habits from the catalogue, one family at a time', () => {
    const seed = buildSeed()
    const habits = exampleHabits(seed.habit_templates, seed.families, FROM)
    expect(habits).toHaveLength(8)
    expect(new Set(habits.map((h) => h.id)).size).toBe(8)
    expect(new Set(habits.map((h) => h.family_id)).size).toBeGreaterThan(3)
    expect(habits.every((h) => h.start_date === FROM && !h.archived)).toBe(true)
  })
})
