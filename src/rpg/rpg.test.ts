import { describe, expect, it } from 'vitest'
import { indexValidations as buildIndex } from '../domain/schedule'
import type { Habit, Validation } from '../domain/types'
import type { LoggedSet } from '../training/types'
import { dungeonLine, monsterFor, monsterHp, monstersDefeated, WINGS } from './dungeon'
import { hasSuivappData, planCopy, vividColors } from './suivappCopy'
import { bossFight, BOSSES, gearTier, heroClass, nextRank, rankTitle, tavernLine, weeklyBoss, xpCheer } from './lore'

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

const validation = (day: string, over: Partial<Validation> = {}): Validation =>
  ({ id: `v-${day}`, habit_id: 'h1', day, moment: 'morning', value: 1, steps: [], xp_earned: 10, ...over }) as Validation

describe('hero rank, gear and class', () => {
  it('gives a title by level', () => {
    expect(rankTitle(1)).toBe('Recrue')
    expect(rankTitle(4)).toBe('Apprenti')
    expect(rankTitle(8)).toBe('Héros local')
    expect(rankTitle(99)).toBe('Mythe ambulant')
    expect(nextRank(4)).toEqual({ level: 5, title: 'Aventurier' })
    expect(nextRank(30)).toBeNull()
  })

  it('adds one piece of gear per rank, capped at 5', () => {
    expect(gearTier(1)).toBe(0)
    expect(gearTier(3)).toBe(1)
    expect(gearTier(12)).toBe(4)
    expect(gearTier(99)).toBe(5)
  })

  it('names the class after the favourite characteristic', () => {
    expect(heroClass('Grâce')).toBe('Barde déhanché')
    expect(heroClass(null)).toBe('Recrue de la taverne')
    expect(heroClass('Cuisine')).toContain('Cuisine')
  })
})

describe('boss of the week', () => {
  it('changes every week and loops over the list', () => {
    expect(weeklyBoss('2026-11-09')).not.toEqual(weeklyBoss('2026-11-16'))
    expect(BOSSES).toContain(weeklyBoss('2020-06-01'))
    expect(weeklyBoss('2026-11-09')).toEqual(weeklyBoss('2026-11-09'))
  })

  it('has one hit point per habit due in the week, minus the habits done', () => {
    const index = buildIndex([validation('2026-11-09'), validation('2026-11-10')])
    const fight = bossFight([habit()], index, '2026-11-09')
    expect(fight.maxHp).toBe(7)
    expect(fight.hp).toBe(5)
    expect(fight.defeated).toBe(false)
  })

  const week = ['09', '10', '11', '12', '13', '14', '15'].map((d) => `2026-11-${d}`)

  it('is defeated when every habit of the week is done, and absent without habits', () => {
    const fight = bossFight([habit()], buildIndex(week.map((d) => validation(d))), '2026-11-09')
    expect(fight).toEqual({ maxHp: 7, hp: 0, defeated: true, forgiven: 0 })
    expect(bossFight([], buildIndex([]), '2026-11-09')).toEqual({ maxHp: 0, hp: 0, defeated: false, forgiven: 0 })
  })

  it('forgives one missed day per habit, like a complete week', () => {
    const fight = bossFight([habit()], buildIndex(week.slice(0, 6).map((d) => validation(d))), '2026-11-09')
    expect(fight).toEqual({ maxHp: 7, hp: 0, defeated: true, forgiven: 1 })
  })

  it('holds a second miss on the same habit against you', () => {
    const fight = bossFight([habit()], buildIndex(week.slice(0, 5).map((d) => validation(d))), '2026-11-09')
    expect(fight.defeated).toBe(false)
    expect(fight.hp).toBe(2)
    expect(fight.forgiven).toBe(0)
  })

  it('counts the misses habit by habit, not all together', () => {
    const a = habit({ id: 'a' })
    const b = habit({ id: 'b' })
    const missOnePerHabit = [...week.slice(1).map((d) => validation(d, { id: `a-${d}`, habit_id: 'a' })), ...week.slice(0, 6).map((d) => validation(d, { id: `b-${d}`, habit_id: 'b' }))]
    expect(bossFight([a, b], buildIndex(missOnePerHabit), '2026-11-09')).toEqual({ maxHp: 14, hp: 0, defeated: true, forgiven: 2 })
    const twoOnOneHabit = [...week.slice(2).map((d) => validation(d, { id: `a-${d}`, habit_id: 'a' })), ...week.map((d) => validation(d, { id: `b-${d}`, habit_id: 'b' }))]
    expect(bossFight([a, b], buildIndex(twoOnOneHabit), '2026-11-09').defeated).toBe(false)
  })
})

describe('tavern keeper', () => {
  it('always has something to say, and says the same thing for the same day', () => {
    for (const [done, total, hour] of [[0, 0, 9], [0, 4, 8], [0, 4, 14], [0, 4, 21], [1, 4, 10], [3, 4, 10], [4, 4, 10]]) {
      const line = tavernLine({ done, total, hour, seed: '2026-11-12' })
      expect(line.length).toBeGreaterThan(10)
      expect(tavernLine({ done, total, hour, seed: '2026-11-12' })).toBe(line)
    }
  })

  it('varies from one day to the next, with no broken text', () => {
    const days = Array.from({ length: 60 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
    for (const [done, total, hour] of [[0, 0, 9], [0, 4, 8], [0, 4, 14], [0, 4, 21], [1, 5, 10], [2, 4, 10], [3, 4, 10], [4, 4, 10]]) {
      const lines = days.map((seed) => tavernLine({ done, total, hour, seed }))
      expect(new Set(lines).size).toBeGreaterThanOrEqual(4)
      for (const line of lines) expect(line).not.toMatch(/undefined|NaN|\$\{/)
    }
  })

  it('speaks of the last quest in the singular', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) expect(tavernLine({ done: 3, total: 4, hour: 10, seed })).not.toMatch(/\b1 quêtes\b/)
  })

  it('counts what is left', () => {
    expect(tavernLine({ done: 3, total: 4, hour: 10, seed: 'a' })).not.toContain('undefined')
    expect(xpCheer(10).length).toBeGreaterThan(2)
    expect(xpCheer(60).length).toBeGreaterThan(2)
  })
})

describe('copy from Suivapp', () => {
  it('copies the tables under this app prefix and leaves device preferences alone', () => {
    const plan = planCopy(['suivapp:habits', 'suivapp:theme', 'suivapp:training-draft', 'suivapp-rpg:habits', 'other'])
    expect(plan).toEqual([{ from: 'suivapp:habits', to: 'suivapp-rpg:habits' }])
  })

  it('swaps the sober default colors for vivid ones, and keeps the colors the user picked', () => {
    const families = JSON.stringify([{ id: 'a', color: '#4F8A6B' }, { id: 'b', color: '#b5613c' }, { id: 'c', color: '#123456' }])
    expect(JSON.parse(vividColors('families', families))).toEqual([{ id: 'a', color: '#22B573' }, { id: 'b', color: '#FF6B3D' }, { id: 'c', color: '#123456' }])
    expect(JSON.parse(vividColors('events', JSON.stringify([{ id: 'e', color: '#3F6B52', title: 'x' }])))).toEqual([{ id: 'e', color: '#22B573', title: 'x' }])
  })

  it('offers the copy only when Suivapp has habits and a profile', () => {
    const store = (entries: Record<string, string>) => ({ getItem: (k: string) => entries[k] ?? null })
    const one = JSON.stringify([{ id: 'x' }])
    expect(hasSuivappData(store({ 'suivapp:habits': one, 'suivapp:profile': one }))).toBe(true)
    expect(hasSuivappData(store({ 'suivapp:habits': one }))).toBe(false)
    expect(hasSuivappData(store({ 'suivapp:habits': '[]', 'suivapp:profile': one }))).toBe(false)
    expect(hasSuivappData(store({ 'suivapp:habits': 'oops', 'suivapp:profile': one }))).toBe(false)
    expect(hasSuivappData(store({}))).toBe(false)
  })

  it('leaves other tables and unreadable data alone', () => {
    const habits = JSON.stringify([{ id: 'h', color: '#4F8A6B' }])
    expect(vividColors('habits', habits)).toBe(habits)
    expect(vividColors('families', 'not json')).toBe('not json')
    expect(vividColors('families', '{"color":"#4F8A6B"}')).toBe('{"color":"#4F8A6B"}')
  })
})

describe('dungeon', () => {
  const set = (item_id: string, index: number, done: boolean, chained = false): LoggedSet =>
    ({ item_id, exercise_id: `ex-${item_id}`, index, reps: 10, weight: 20, done, chained }) as LoggedSet

  it('gives each exercise a stable monster', () => {
    expect(monsterFor('bench')).toEqual(monsterFor('bench'))
    expect(monsterFor('bench').emoji.length).toBeGreaterThan(0)
  })

  it('counts one hit point per main set, chained movements apart', () => {
    const rows = [set('a', 0, true), set('a', 0, false, true), set('a', 1, false), set('a', 2, false)]
    expect(monsterHp(rows)).toEqual({ hp: 2, maxHp: 3, defeated: false })
    expect(monsterHp([set('a', 0, true), set('a', 1, true)]).defeated).toBe(true)
    expect(monsterHp([]).defeated).toBe(false)
  })

  it('counts the monsters defeated in a session', () => {
    expect(monstersDefeated([set('a', 0, true), set('a', 1, true), set('b', 0, true), set('b', 1, false)])).toBe(1)
  })

  it('has a line for every stage of the week', () => {
    for (const done of [0, 1, 2, 3, 4]) {
      const line = dungeonLine({ done, target: 3, next: 'Training 1', seed: '2026-11-19' })
      expect(line.length).toBeGreaterThan(10)
      expect(line).not.toContain('undefined')
    }
    expect(WINGS.dance.stat).toBe('Grâce')
  })
})
