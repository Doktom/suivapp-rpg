import { describe, expect, it } from 'vitest'
import { activityDayValue, heatmapWeeks, weekdayRates, weeklyRates } from './stats'
import { trainingToday } from '../training/today'

describe('heatmapWeeks', () => {
  it('ends with the current week, Monday first, future days empty', () => {
    const grid = heatmapWeeks('2026-11-11', 3, () => 1) // Wednesday
    expect(grid).toHaveLength(3)
    expect(grid[2][0].day).toBe('2026-11-09')
    expect(grid[2][2].value).toBe(1)
    expect(grid[2][3].value).toBeNull()
    expect(grid[0][0].day).toBe('2026-10-26')
  })
})

describe('activityDayValue', () => {
  it('scales with the number of sessions', () => {
    const v = activityDayValue(['2026-11-10', '2026-11-10', '2026-11-09'])
    expect(v('2026-11-10')).toBe(1)
    expect(v('2026-11-09')).toBe(0.5)
    expect(v('2026-11-08')).toBe(0)
  })
})

describe('empty data', () => {
  it('has no rates without habits', () => {
    expect(weekdayRates([], new Map() as never, '2026-11-01', '2026-11-10', '2026-11-11').every((r) => r === null)).toBe(true)
    expect(weeklyRates([], new Map() as never, '2026-11-11', 4)).toHaveLength(4)
  })
  it('offers nothing to do today without sessions', () => {
    const t = trainingToday([], [], [], [], '2026-11-11')
    expect(t.sport).toBeNull()
    expect(t.mobility).toEqual([])
    expect(t.dance).toEqual([])
  })
})
