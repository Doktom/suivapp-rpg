import type { Avoid, Frequency, HabitShape } from './types'

const WEEK_NAMES = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']

export const WORKWEEK = [0, 1, 2, 3, 4]
export const WEEKEND = [5, 6]

const same = (a: number[], b: number[]) => a.length === b.length && [...a].sort().every((d, i) => d === b[i])

/** Is this set of days "Monday to Friday" or "Saturday and Sunday"? */
export function weekdaysPreset(days: number[]): 'workweek' | 'weekend' | null {
  if (same(days, WORKWEEK)) return 'workweek'
  if (same(days, WEEKEND)) return 'weekend'
  return null
}

export function describeFrequency(f: Frequency): string {
  if (f.type === 'daily') return 'Tous les jours'
  if (f.type === 'weekdays') {
    const preset = weekdaysPreset(f.days)
    if (preset === 'workweek') return 'En semaine'
    if (preset === 'weekend') return 'Le week-end'
    return f.days.map((d) => WEEK_NAMES[d]).join(', ')
  }
  if (f.type === 'per_week') return `${f.count} fois par semaine`
  if (f.type === 'per_month') return `${f.count} fois par mois`
  return f.interval <= 1 ? 'Tous les jours' : `Tous les ${f.interval} jours`
}

const hour = (time: string) => time.replace(/^0/, '').replace(':00', ' h').replace(':', ' h ')

export function describeAvoid(a: Avoid): string {
  const parts: string[] = []
  if (a.before && a.after) parts.push(`avant ${hour(a.before)} et après ${hour(a.after)}`)
  else if (a.before) parts.push(`avant ${hour(a.before)}`)
  else if (a.after) parts.push(`après ${hour(a.after)}`)
  if (a.tolerance > 0) parts.push(`${a.tolerance} écart${a.tolerance > 1 ? 's' : ''} toléré${a.tolerance > 1 ? 's' : ''} par ${a.period === 'week' ? 'semaine' : 'jour'}`)
  return parts.join(', ')
}

/** A short summary of how a habit is tracked, for lists. */
export function describeTracking(h: HabitShape): string {
  const fmt = (n: number) => n.toLocaleString('fr-FR')
  switch (h.tracking) {
    case 'duration':
    case 'quantity':
      return `${fmt(h.goal)} ${h.unit}`
    case 'levels':
      return h.levels.map((l) => l.detail || l.name).join(' / ')
    case 'routine':
      return `${h.steps.length} étape${h.steps.length > 1 ? 's' : ''}${h.levels.length > 0 ? ` · ${h.levels.length} niveaux` : ''}`
    case 'avoid':
      return ['À éviter', h.avoid ? describeAvoid(h.avoid) : ''].filter(Boolean).join(' · ')
    default:
      return ''
  }
}
