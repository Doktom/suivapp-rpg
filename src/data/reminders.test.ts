import { describe, expect, it } from 'vitest'
import { dueSlot, reminderText, type ReminderSettings } from './reminders'

const on: ReminderSettings = { enabled: true, morning: '08:00', evening: '20:00' }

describe('dueSlot', () => {
  it('does nothing when disabled or before the time', () => {
    expect(dueSlot({ ...on, enabled: false }, '21:00', '2026-11-11', {})).toBeNull()
    expect(dueSlot(on, '07:59', '2026-11-11', {})).toBeNull()
  })
  it('fires once per slot and day', () => {
    expect(dueSlot(on, '08:30', '2026-11-11', {})).toBe('morning')
    expect(dueSlot(on, '08:30', '2026-11-11', { morning: '2026-11-11' })).toBeNull()
    expect(dueSlot(on, '08:30', '2026-11-12', { morning: '2026-11-11' })).toBe('morning')
  })
  it('prefers the evening when both are late, and skips an empty slot', () => {
    expect(dueSlot(on, '21:00', '2026-11-11', {})).toBe('evening')
    expect(dueSlot({ ...on, morning: null, evening: null }, '21:00', '2026-11-11', {})).toBeNull()
  })
})

describe('reminderText', () => {
  it('summarises what is left', () => {
    expect(reminderText('evening', 2, ['Sport'])).toBe('Il reste : 2 habitudes à faire · Sport.')
    expect(reminderText('morning', 1, [])).toBe('Au programme : 1 habitude à faire.')
  })
  it('stays silent in the morning with nothing to do, congratulates in the evening', () => {
    expect(reminderText('morning', 0, [])).toBeNull()
    expect(reminderText('evening', 0, [])).toBe('Journée bouclée, bravo !')
  })
})
