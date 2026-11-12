/** Reminders: chosen per device (stored in this browser). They fire while the app is open or installed and running. */
export interface ReminderSettings {
  enabled: boolean
  /** "HH:MM" times of day. */
  morning: string | null
  evening: string | null
}

const KEY = 'suivapp-rpg:reminders'
const SENT_KEY = 'suivapp-rpg:reminders-sent'
export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, morning: '08:00', evening: '20:00' }

export function readReminders(): ReminderSettings {
  try {
    return { ...DEFAULT_REMINDERS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT_REMINDERS
  }
}

export function writeReminders(settings: ReminderSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Private browsing: the choice lasts until the page is closed.
  }
}

function readSent(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function markSent(slot: Slot, day: string) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify({ ...readSent(), [slot]: day }))
  } catch {
    // Nothing to do: the reminder may then show once more.
  }
}

export type Slot = 'morning' | 'evening'

/** Which reminder is due now: its time has passed today and it was not sent yet. Evening wins if both are due. */
export function dueSlot(settings: ReminderSettings, clock: string, day: string, sent: Record<string, string> = readSent()): Slot | null {
  if (!settings.enabled) return null
  for (const slot of ['evening', 'morning'] as const) {
    const at = settings[slot]
    if (at && clock >= at && sent[slot] !== day) return slot
  }
  return null
}

/** Text of a reminder from what remains to do today. */
export function reminderText(slot: Slot, remainingHabits: number, trainingLeft: string[]): string | null {
  const parts: string[] = []
  if (remainingHabits > 0) parts.push(`${remainingHabits} habitude${remainingHabits > 1 ? 's' : ''} à faire`)
  if (trainingLeft.length > 0) parts.push(trainingLeft.join(', '))
  if (parts.length === 0) return slot === 'evening' ? 'Journée bouclée, bravo !' : null
  return `${slot === 'morning' ? 'Au programme' : 'Il reste'} : ${parts.join(' · ')}.`
}

export const notificationsSupported = () => typeof Notification !== 'undefined'

export async function showNotification(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const icon = `${import.meta.env.BASE_URL}icons/icon-192.png`
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon, badge: icon })
    else new Notification(title, { body, icon })
  } catch {
    new Notification(title, { body, icon })
  }
}
