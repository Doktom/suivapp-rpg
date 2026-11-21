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

/**
 * Suivapp's default colors, and the vivid one that replaces each here. Only these exact values are
 * replaced: a color the user picked is theirs and stays as it is.
 */
export const VIVID_COLORS: Record<string, string> = {
  '#4f8a6b': '#22B573', // Santé, Courses
  '#b5613c': '#FF6B3D', // Sport
  '#a64d79': '#FF4F9A', // Danse
  '#6a5a86': '#8B5CF6', // Souplesse
  '#c08a3e': '#FFB300', // Skincare
  '#3d6673': '#14B8C4', // Mental, Admin
  '#7a7355': '#84B82D', // Maison
  '#4a63a0': '#3B82F6', // Apprentissage
  '#3f6b52': '#22B573', // Default of new lists and events
}

/** Tables whose rows carry a `color`. */
const COLORED_TABLES = ['families', 'task_lists', 'events']

/** Rewrites a table's JSON with vivid colors in place of Suivapp's defaults; anything unreadable is left untouched. */
export function vividColors(table: string, json: string): string {
  if (!COLORED_TABLES.includes(table)) return json
  try {
    const rows = JSON.parse(json) as { color?: unknown }[]
    if (!Array.isArray(rows)) return json
    return JSON.stringify(rows.map((r) => (typeof r?.color === 'string' && VIVID_COLORS[r.color.toLowerCase()] ? { ...r, color: VIVID_COLORS[r.color.toLowerCase()] } : r)))
  } catch {
    return json
  }
}

const allKeys = (storage: Storage) => Array.from({ length: storage.length }, (_, i) => storage.key(i)!)

/**
 * True when Suivapp has habits saved in this browser, and its profile: without a profile this app
 * would take the copy for an empty start and add its own starter data on top.
 */
export function hasSuivappData(storage: Pick<Storage, 'getItem'> = localStorage): boolean {
  const filled = (table: string) => {
    try {
      const rows = JSON.parse(storage.getItem(`${SOURCE_PREFIX}${table}`) ?? '[]') as unknown
      return Array.isArray(rows) && rows.length > 0
    } catch {
      return false
    }
  }
  return filled('habits') && filled('profile')
}

/** Replaces this app's tables with a copy of Suivapp's. Returns how many tables were copied. */
export function copyFromSuivapp(storage: Storage = localStorage): number {
  const plan = planCopy(allKeys(storage))
  // Tables that exist here but not in Suivapp must not survive, or the two sets of rows would mix.
  for (const key of allKeys(storage)) {
    if (key.startsWith(TARGET_PREFIX) && !SKIPPED.includes(key.slice(TARGET_PREFIX.length))) storage.removeItem(key)
  }
  for (const { from, to } of plan) storage.setItem(to, vividColors(from.slice(SOURCE_PREFIX.length), storage.getItem(from)!))
  return plan.length
}
