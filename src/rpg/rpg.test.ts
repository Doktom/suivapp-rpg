import { describe, expect, it } from 'vitest'
import { indexValidations as buildIndex } from '../domain/schedule'
import type { Habit, Validation } from '../domain/types'
import { planCopy } from './suivappCopy'
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

  it('is defeated when every habit of the week is done, and absent without habits', () => {
    const days = ['09', '10', '11', '12', '13', '14', '15'].map((d) => validation(`2026-11-${d}`))
    expect(bossFight([habit()], buildIndex(days), '2026-11-09').defeated).toBe(true)
    expect(bossFight([], buildIndex([]), '2026-11-09')).toEqual({ maxHp: 0, hp: 0, defeated: false })
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
})
