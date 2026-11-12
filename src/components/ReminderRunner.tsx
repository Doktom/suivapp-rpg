import { useEffect } from 'react'
import { dueSlot, markSent, readReminders, reminderText, showNotification } from '../data/reminders'
import { useStore, useToday, useValidationIndex } from '../data/store'
import { clockTime } from '../domain/date'
import { isAvoidOk, isAvoidSettled, isDayDone, isDueOn } from '../domain/schedule'
import { trainingToday } from '../training/today'

/** Shows the morning / evening reminder once its time has passed, while the app is running. Renders nothing. */
export function ReminderRunner() {
  const { data, now } = useStore()
  const today = useToday()
  const index = useValidationIndex()

  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const settings = readReminders()
    const clock = clockTime(now)
    const slot = dueSlot(settings, clock, today)
    if (!slot) return
    markSent(slot, today)
    const remaining = data.habits.filter(
      (h) => isDueOn(h, index, today) && !isDayDone(h, index, today) && !(h.tracking === 'avoid' && isAvoidOk(h, data.slips, today) && !isAvoidSettled(h, today, today, clock)),
    ).length
    const t = trainingToday(data.training_sessions, data.training_logs, data.dance_classes, data.dance_sessions, today)
    const left: string[] = []
    if (t.sport && !t.sport.doneToday) left.push(`séance ${t.sport.session.name}`)
    for (const c of t.dance) if (!c.done) left.push(`cours à ${c.danceClass.start_time}`)
    const text = reminderText(slot, remaining, left)
    if (text) void showNotification('Suivapp RPG', text)
  }, [now, today, data, index])

  return null
}
