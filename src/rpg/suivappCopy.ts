/**
 * Suivapp (the sober version) and Suivapp RPG are served from the same domain, so this app can read the
 * other one's browser storage. The copy is one-way: Suivapp's keys are only read, never written.
 */
export const SOURCE_PREFIX = 'suivapp:'
export const TARGET_PREFIX = 'suivapp-rpg:'

/** Per-device preferences and work in progress stay where they are. */
const SKIPPED = ['theme', 'reminders', 'reminders-sent', 'training-draft', 'mobility-draft']

/** Which keys to copy, and where to: every Suivapp table, renamed with this app's prefix. */
export function planCopy(keys: string[]): { from: string; to: string }[] {
  return keys
    .filter((k) => k.startsWith(SOURCE_PREFIX) && !SKIPPED.includes(k.slice(SOURCE_PREFIX.length)))
    .map((k) => ({ from: k, to: TARGET_PREFIX + k.slice(SOURCE_PREFIX.length) }))
}

const allKeys = (storage: Storage) => Array.from({ length: storage.length }, (_, i) => storage.key(i)!)

/** True when Suivapp has habits saved in this browser. */
export function hasSuivappData(storage: Storage = localStorage): boolean {
  try {
    return (JSON.parse(storage.getItem(`${SOURCE_PREFIX}habits`) ?? '[]') as unknown[]).length > 0
  } catch {
    return false
  }
}

/** Replaces this app's tables with a copy of Suivapp's. Returns how many tables were copied. */
export function copyFromSuivapp(storage: Storage = localStorage): number {
  const plan = planCopy(allKeys(storage))
  // Tables that exist here but not in Suivapp must not survive, or the two sets of rows would mix.
  for (const key of allKeys(storage)) {
    if (key.startsWith(TARGET_PREFIX) && !SKIPPED.includes(key.slice(TARGET_PREFIX.length))) storage.removeItem(key)
  }
  for (const { from, to } of plan) storage.setItem(to, storage.getItem(from)!)
  return plan.length
}
