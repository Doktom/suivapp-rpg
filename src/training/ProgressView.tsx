import { useState } from 'react'
import { inputClass, SectionTitle } from '../components/ui'
import { useStore } from '../data/store'
import { formatShortDay } from '../domain/date'
import { BarChart, LineChart } from './Charts'
import { exerciseHistory, personalRecords, weeklyVolume } from './stats'
import type { TrainingLog } from './types'

const VOLUME_WEEKS = 12
const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

/** Sport progress: one exercise over time, weekly volume, and personal records. */
export function ProgressView({ logs }: { logs: TrainingLog[] }) {
  const { data, today } = useStore()
  const records = personalRecords(logs, data.training_exercises)
  const [picked, setExerciseId] = useState<string>('')
  // Falls back to the most recently trained exercise.
  const exerciseId = records.some((r) => r.exercise.id === picked) ? picked : (records[0]?.exercise.id ?? '')
  const history = exerciseHistory(exerciseId, logs)
  const weighted = history.some((p) => p.weight > 0)
  const weeks = weeklyVolume(logs, today, VOLUME_WEEKS)

  if (logs.length === 0) {
    return <p className="card p-4 text-muted">Les courbes apparaîtront après ta première séance.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Par exercice</SectionTitle>
          <select aria-label="Exercice" className={`${inputClass} !w-auto min-w-0 max-w-full`} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            {records.map((r) => <option key={r.exercise.id} value={r.exercise.id}>{r.exercise.name}</option>)}
          </select>
        </div>
        {history.length > 0 && (
          <LineChart
            title={weighted ? 'Charge la plus lourde par séance' : 'Répétitions max par séance'}
            unit={weighted ? 'kg' : 'reps'}
            data={history.map((p) => ({
              label: formatShortDay(p.day),
              value: weighted ? p.weight : p.reps,
              tip: `${formatShortDay(p.day)} · ${p.sets.map((s) => `${s.reps}${s.weight ? `×${fmt(s.weight)}` : ''}`).join(', ')}`,
            }))}
          />
        )}
        {history.length === 1 && <p className="text-[13px] text-muted">Une seule séance pour l'instant : la courbe se dessinera à la prochaine.</p>}
      </section>

      <section className="card p-3">
        <BarChart
          title={`Volume par semaine (${VOLUME_WEEKS} dernières semaines)`}
          unit="kg"
          data={weeks.map((w) => ({
            label: formatShortDay(w.week),
            value: Math.round(w.volume),
            tip: `Semaine du ${formatShortDay(w.week)} · ${fmt(Math.round(w.volume))} kg · ${w.sessions} séance${w.sessions > 1 ? 's' : ''}`,
          }))}
        />
      </section>

      <section>
        <SectionTitle>Records personnels</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-[12px] text-muted">
              <tr>
                <th className="py-2 font-medium">Exercice</th>
                <th className="py-2 text-right font-medium">Charge max</th>
                <th className="py-2 text-right font-medium">Reps max</th>
                <th className="py-2 text-right font-medium">Séances</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.exercise.id} className="border-t border-line">
                  <td className="py-2">
                    <button type="button" className="text-left font-medium" onClick={() => setExerciseId(r.exercise.id)}>{r.exercise.name}</button>
                    <span className="block text-[12px] text-muted">{r.exercise.muscle}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {r.weight > 0 ? `${fmt(r.weight)} kg` : '—'}
                    {r.weightDay && <span className="block text-[12px] text-muted">{formatShortDay(r.weightDay)}</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{r.reps}</td>
                  <td className="py-2 text-right tabular-nums">{r.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
