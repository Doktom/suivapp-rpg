import { useMemo } from 'react'
import { SectionTitle } from '../components/ui'
import { useStore, useValidationIndex } from '../data/store'
import { addDays, formatShortDay } from '../domain/date'
import { activityDayValue, habitDayValue, heatmapWeeks, weekdayRates, weeklyRates, type HeatCell } from '../domain/stats'

const WEEKS = 20
const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const pct = (r: number) => `${Math.round(r * 100)} %`

function Heatmap({ grid, label, describe }: { grid: HeatCell[][]; label: string; describe: (c: HeatCell) => string }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={label}>
      <div className="flex flex-col gap-[3px] pt-0 text-[9px] text-muted">
        {DAY_LETTERS.map((l, i) => <span key={i} className="flex aspect-square w-3 items-center">{i % 2 === 0 ? l : ''}</span>)}
      </div>
      <div className="grid min-w-0 flex-1 gap-[3px]" style={{ gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))` }}>
        {grid.map((week) => (
          <div key={week[0].day} className="flex flex-col gap-[3px]">
            {week.map((c) => (
              <span
                key={c.day}
                title={describe(c)}
                className="aspect-square w-full rounded-[3px]"
                style={{ background: c.value === null ? 'transparent' : `color-mix(in srgb, var(--color-accent) ${Math.round(c.value * 100)}%, var(--color-track))` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** General statistics: heatmaps of habits and training, weekday profile, weekly trend. */
export function StatsSection() {
  const { data, today } = useStore()
  const index = useValidationIndex()
  const habits = data.habits
  const habitGrid = useMemo(() => heatmapWeeks(today, WEEKS, habitDayValue(habits, index, today)), [habits, index, today])
  const trainingDays = useMemo(
    () => [...data.training_logs.map((l) => l.day), ...data.dance_sessions.filter((s) => s.status === 'done').map((s) => s.day)],
    [data.training_logs, data.dance_sessions],
  )
  const trainingGrid = useMemo(() => heatmapWeeks(today, WEEKS, activityDayValue(trainingDays)), [trainingDays, today])
  const byWeekday = useMemo(() => weekdayRates(habits, index, addDays(today, -89), today, today), [habits, index, today])
  const trend = useMemo(() => weeklyRates(habits, index, today, 12), [habits, index, today])
  const trainedDays = new Set(trainingDays.filter((d) => d > addDays(today, -WEEKS * 7))).size

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Le grimoire des chiffres</SectionTitle>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2 card p-3">
          <h2 className="font-display text-base">Quêtes, {WEEKS} dernières semaines</h2>
          <Heatmap grid={habitGrid} label="Carte de chaleur des habitudes" describe={(c) => (c.value === null ? formatShortDay(c.day) : `${formatShortDay(c.day)} : ${pct(c.value)}`)} />
          <p className="text-[12px] text-muted">Plus la case est foncée, plus la journée était complète. Case vide : rien de prévu.</p>
        </div>
        <div className="flex flex-col gap-2 card p-3">
          <h2 className="font-display text-base">Entraînement et danse</h2>
          <Heatmap grid={trainingGrid} label="Carte de chaleur de l'entraînement" describe={(c) => formatShortDay(c.day)} />
          <p className="text-[12px] text-muted">{trainedDays} jour{trainedDays > 1 ? 's' : ''} actif{trainedDays > 1 ? 's' : ''} sur {WEEKS} semaines (clair : 1 séance, foncé : 2 ou plus).</p>
        </div>
        <div className="flex flex-col gap-2 card p-3">
          <h2 className="font-display text-base">Réussite par jour de la semaine</h2>
          <div className="flex h-24 items-end gap-2" aria-label="Réussite par jour de la semaine, 90 derniers jours">
            {byWeekday.map((r, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-muted tabular-nums">{r === null ? '' : Math.round(r * 100)}</span>
                <span className="w-full rounded-sm bg-accent" style={{ height: `${Math.max(2, (r ?? 0) * 100)}%`, opacity: r === null ? 0.2 : 1 }} />
                <span className="text-[11px] text-muted">{DAY_LETTERS[i]}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-muted">Sur les 90 derniers jours.</p>
        </div>
        <div className="flex flex-col gap-2 card p-3">
          <h2 className="font-display text-base">Tendance, 12 semaines</h2>
          <div className="flex h-24 items-end gap-1" aria-label="Taux de réussite par semaine">
            {trend.map((w) => (
              <span key={w.monday} title={`${formatShortDay(w.monday)} : ${w.rate === null ? '—' : pct(w.rate)}`} className="flex-1 rounded-sm bg-accent" style={{ height: `${Math.max(2, (w.rate ?? 0) * 100)}%`, opacity: w.rate === null ? 0.2 : 1 }} />
            ))}
          </div>
          <p className="text-[12px] text-muted">Taux de quêtes tenues, semaine par semaine (la dernière est en cours).</p>
        </div>
      </div>
    </section>
  )
}
