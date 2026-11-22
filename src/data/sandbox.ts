/**
 * Sandbox: a copy of the data to play with, and a clock that can run ahead of the real one.
 *
 * In the sandbox every table lives under its own storage prefix, so the real data is never read
 * nor written until the sandbox is left. The mode is fixed when the page loads: entering or leaving
 * it reloads the page.
 */
export const REAL_PREFIX = 'suivapp-rpg:'
export const SIM_PREFIX = 'suivapp-rpg-sim:'
const META_KEY = 'suivapp-rpg-meta:sandbox'
const DAY_MS = 86_400_000

/** Device preferences and work in progress are not part of the data: they are never copied. */
export const DEVICE_KEYS = ['theme', 'reminders', 'reminders-sent', 'training-draft', 'mobility-draft']

export interface SandboxMeta {
  active: boolean
  offsetDays: number
}

export function parseMeta(raw: string | null): SandboxMeta {
  try {
    const meta = JSON.parse(raw ?? 'null') as Partial<SandboxMeta> | null
    if (meta?.active === true) return { active: true, offsetDays: Number.isFinite(meta.offsetDays) ? Math.trunc(meta.offsetDays as number) : 0 }
  } catch {
    // Unreadable: behave as if there was no sandbox.
  }
  return { active: false, offsetDays: 0 }
}

/** Keys to copy from one prefix to the other, device preferences excluded. */
export function planTransfer(keys: string[], from: string, to: string): { from: string; to: string }[] {
  return keys
    .filter((k) => k.startsWith(from) && !DEVICE_KEYS.includes(k.slice(from.length)))
    .map((k) => ({ from: k, to: to + k.slice(from.length) }))
}

const allKeys = (storage: Storage) => Array.from({ length: storage.length }, (_, i) => storage.key(i)!)

function readMeta(): SandboxMeta {
  try {
    return parseMeta(localStorage.getItem(META_KEY))
  } catch {
    return { active: false, offsetDays: 0 }
  }
}

let meta = readMeta()

export const isSandbox = meta.active
/** Where this page keeps its data. */
export const PREFIX = isSandbox ? SIM_PREFIX : REAL_PREFIX

export const simOffsetDays = () => meta.offsetDays

/** The current moment: the real clock, plus the days travelled in the sandbox. */
export const simNow = () => new Date(Date.now() + (isSandbox ? meta.offsetDays : 0) * DAY_MS)

/** Moves the sandbox clock; the caller refreshes the store's clock afterwards. */
export function setSimOffsetDays(days: number, storage: Storage = localStorage) {
  if (!isSandbox) return
  meta = { active: true, offsetDays: Math.trunc(days) }
  storage.setItem(META_KEY, JSON.stringify(meta))
}

function clearSim(storage: Storage) {
  for (const key of allKeys(storage)) if (key.startsWith(SIM_PREFIX)) storage.removeItem(key)
}

/** Copies the real data into the sandbox and turns it on. The caller reloads the page. */
export function enterSandbox(storage: Storage = localStorage) {
  clearSim(storage)
  for (const { from, to } of planTransfer(allKeys(storage), REAL_PREFIX, SIM_PREFIX)) storage.setItem(to, storage.getItem(from)!)
  storage.setItem(META_KEY, JSON.stringify({ active: true, offsetDays: 0 }))
}

/** Throws the sandbox away; the real data was never touched. The caller reloads the page. */
export function leaveSandbox(storage: Storage = localStorage) {
  clearSim(storage)
  storage.removeItem(META_KEY)
}
