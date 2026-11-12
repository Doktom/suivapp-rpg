import { useState } from 'react'
import { Button, Dialog } from '../components/ui'
import { useStore } from '../data/store'
import { formatLongDay } from '../domain/date'
import { formatDuration, volume } from './logic'
import { FEELING_LABELS, type TrainingLog } from './types'

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

/** Everything about one past session, with the option to delete it. */
export function LogDetail({ log, onClose }: { log: TrainingLog; onClose: () => void }) {
  const { data, remove } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const name = (id: string) => data.training_exercises.find((e) => e.id === id)?.name ?? 'Exercice supprimé'
  const wod = data.training_wods.find((w) => w.id === log.wod_id)
  // Sets grouped by exercise, in the order they were done.
  const groups: { exerciseId: string; chained: boolean; sets: TrainingLog['sets'] }[] = []
  for (const s of log.sets) {
    const group = groups.find((g) => g.exerciseId === s.exercise_id && g.chained === s.chained)
    if (group) group.sets.push(s)
    else groups.push({ exerciseId: s.exercise_id, chained: s.chained, sets: [s] })
  }
  const rounds = Object.values(log.circuits).reduce((a, b) => a + b, 0)
  const mobility = log.discipline === 'mobility'
  // Mobility steps are logged in seconds held, or in reps.
  const holdOf = (itemId: string) => {
    for (const s of data.training_sessions) for (const i of s.items) if (i.id === itemId && i.kind === 'hold') return i
    return null
  }
  const describeSet = (s: TrainingLog['sets'][number]) =>
    mobility ? `${s.reps} ${holdOf(s.item_id)?.hold_s ? 's' : 'reps'}` : `${s.reps}${s.weight ? ` × ${fmt(s.weight)} kg` : ''}`

  return (
    <Dialog title={log.name} onClose={onClose}>
      <div className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto">
        <p className="text-sm text-muted">
          {formatLongDay(log.day)} · {formatDuration(log.duration_s)}{mobility ? '' : ` · ${Math.round(volume(log.sets)).toLocaleString('fr-FR')} kg`}
          {log.feeling ? ` · ${FEELING_LABELS[log.feeling]}` : ''} · <span className="font-medium text-accent">+{log.xp_earned} XP</span>
        </p>
        {!mobility && <p className="text-sm">Échauffement : {log.warmup_done ? 'fait' : 'non coché'}{rounds > 0 ? ` · circuit : ${rounds} tour${rounds > 1 ? 's' : ''}` : ''}</p>}
        {groups.map((g) => {
          const done = g.sets.filter((s) => s.done)
          return (
            <section key={`${g.exerciseId}-${g.chained}`} className={`border-t border-line pt-2 ${g.chained ? 'pl-4' : ''}`}>
              <p className="font-medium">
                {g.chained ? '↳ ' : ''}{name(g.exerciseId)}
                {log.records.includes(g.exerciseId) && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-onaccent">Record</span>}
              </p>
              <p className="text-[13px] text-muted tabular-nums">
                {done.length === 0 ? 'Pas fait' : done.map(describeSet).join(' · ')}
                {done.length > 0 && done.length < g.sets.length ? ` (${done.length}/${g.sets.length} ${mobility ? 'fois' : 'séries'})` : ''}
              </p>
            </section>
          )
        })}
        {(wod || log.wod_result) && (
          <section className="border-t border-line pt-2">
            <p className="font-medium">Finisher{wod ? ` : ${wod.name}` : ''}</p>
            {log.wod_result && <p className="text-[13px] text-muted">{log.wod_result}</p>}
          </section>
        )}
        {log.note && <p className="border-t border-line pt-2 text-sm">« {log.note} »</p>}
        {!confirmDelete && <Button className="self-start text-warn" onClick={() => setConfirmDelete(true)}>Supprimer cette séance…</Button>}
        {confirmDelete && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-warn p-3">
            <p className="text-sm">Supprimer cette séance, ses séries et son XP ? C'est définitif.</p>
            <div className="flex gap-2">
              <Button className="!bg-warn !text-onaccent" onClick={() => { remove('training_logs', log.id); onClose() }}>Supprimer</Button>
              <Button onClick={() => setConfirmDelete(false)}>Garder</Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
