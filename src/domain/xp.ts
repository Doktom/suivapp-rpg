import type { Priority, XpSettings } from './types'

export const DEFAULT_XP: XpSettings = {
  habit: 10,
  level_step: 5,
  routine_step: 2,
  task_low: 5,
  task_normal: 10,
  task_high: 20,
  subtask: 5,
  block_bonus: 25,
  streak_bonus: true,
}

export function taskXp(priority: Priority, s: XpSettings = DEFAULT_XP): number {
  return priority === 'low' ? s.task_low : priority === 'high' ? s.task_high : s.task_normal
}

export function streakBonus(streakDays: number): number {
  if (streakDays >= 100) return 0.5
  if (streakDays >= 30) return 0.25
  if (streakDays >= 7) return 0.1
  return 0
}

const withBonus = (xp: number, streakDays: number, s: XpSettings) =>
  Math.round(xp * (1 + (s.streak_bonus ? streakBonus(streakDays) : 0)))

/** Simple, duration and quantity habits: proportional to the goal reached. */
export function validationXp(value: number, goal: number, streakDays: number, s: XpSettings = DEFAULT_XP): number {
  return withBonus(s.habit * Math.min(value / goal, 1), streakDays, s)
}

/** Level 1 earns the base XP, each level above it `level_step` more (10 / 15 / 20 by default). */
export function levelXp(level: number, s: XpSettings = DEFAULT_XP): number {
  return level > 0 ? s.habit + s.level_step * (level - 1) : 0
}

export function levelsValidationXp(level: number, streakDays: number, s: XpSettings = DEFAULT_XP): number {
  return withBonus(levelXp(level, s), streakDays, s)
}

/** Routines: XP per step done, plus the XP of the level reached. A partial routine still earns its steps. */
export function routineXp(stepsDone: number, level: number, streakDays: number, s: XpSettings = DEFAULT_XP): number {
  return withBonus(s.routine_step * stepsDone + levelXp(level, s), streakDays, s)
}

export function xpForNextLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5))
}

export function levelFromXp(totalXp: number) {
  let level = 1
  let xpInLevel = totalXp
  while (xpInLevel >= xpForNextLevel(level)) {
    xpInLevel -= xpForNextLevel(level)
    level++
  }
  return { level, xpInLevel, needed: xpForNextLevel(level) }
}
