import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, CheckButton, inputClass } from '../components/ui'
import { useStore } from '../data/store'
import { beep, useTick, useWakeLock } from './chrono'
import { bests, clock, findRecords, formatDuration, lastSets, randomWod, sessionXp, volume } from './logic'
import { FEELING_LABELS, WOD_FORMAT_LABELS, type ExerciseItem, type Feeling, type LoggedSet, type TrainingLog, type TrainingSession, type Wod } from './types'
import { WodTimer } from './WodTimer'

/** A session in progress, kept in this browser so that a closed tab or a locked phone loses nothing. */
export interface Draft {
  session_id: string
  started_at: string
  sets: LoggedSet[]
  warmup_done: boolean
  circuits: Record<string, number>
  wod_id: string | null
  /** When the finisher chrono started (ms), and its final time (s). */
  wod_started: number | null
  wod_elapsed: number | null
  wod_result: string
  /** End of the current rest (ms). */
  rest_end: number | null
}

const DRAFT_KEY = 'suivapp-rpg:training-draft'

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

export function writeDraft(draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Private browsing: the session is kept in memory only.
  }
}

const numberInput = `${inputClass} !w-16 !px-2 text-center tabular-nums`

function describeTargets(item: ExerciseItem): string {
  const groups: string[] = []
  let i = 0
  while (i < item.sets.length) {
    const s = item.sets[i]
    let n = 1
    while (i + n < item.sets.length && item.sets[i + n].reps === s.reps && item.sets[i + n].note === s.note) n++
    groups.push(`${n}x${s.reps}${s.note ? ` ${s.note}` : ''}`)
    i += n
  }
  return groups.join(' / ')
}

function RestBar({ end, now, onAdd, onSkip }: { end: number; now: number; onAdd: () => void; onSkip: () => void }) {
  const left = (end - now) / 1000
  return (
    <div className="flex items-center gap-2 rounded-xl bg-accent px-3 py-1.5 text-onaccent">
      <span className="text-[13px]">Repos</span>
      <span className="flex-1 font-display text-2xl font-semibold tabular-nums">{clock(left)}</span>
      <button type="button" className="min-h-11 rounded-lg px-2 text-sm font-medium" onClick={onAdd}>+30 s</button>
      <button type="button" className="min-h-11 rounded-lg px-2 text-sm font-medium" onClick={onSkip}>Passer</button>
    </div>
  )
}

export function SessionRunner({ session, draft, setDraft, onClose }: {
  session: TrainingSession
  draft: Draft
  setDraft: (d: Draft | null) => void
  onClose: (saved: TrainingLog | null) => void
}) {
  const { data, save, today } = useStore()
  const now = useTick(true, 250)
  useWakeLock(true)
  const [finishing, setFinishing] = useState(false)
  const [feeling, setFeeling] = useState<Feeling | null>(null)
  const [note, setNote] = useState('')
  const [confirmQuit, setConfirmQuit] = useState(false)

  const exercises = data.training_exercises
  const exerciseName = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercice'
  const best = useMemo(() => bests(data.training_logs), [data.training_logs])
  const wod = data.training_wods.find((w) => w.id === draft.wod_id) ?? null
  const elapsed = (now - Date.parse(draft.started_at)) / 1000
  const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })

  // Rest timer: beeps on the last 3 seconds and at the end, then disappears.
  const restSecond = useRef<number | null>(null)
  const restLeft = draft.rest_end ? Math.ceil((draft.rest_end - now) / 1000) : null
  useEffect(() => {
    if (restLeft === null || restLeft === restSecond.current) return
    restSecond.current = restLeft
    if (restLeft <= 0) {
      beep(true)
      update({ rest_end: null })
    } else if (restLeft <= 3) beep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restLeft])

  const setRow = (target: LoggedSet, patch: Partial<LoggedSet>, rest_s?: number) => {
    const sets = draft.sets.map((s) => (s === target ? { ...s, ...patch } : s))
    update({ sets, rest_end: rest_s ? Date.now() + rest_s * 1000 : draft.rest_end })
  }

  /** Checking a set starts the rest, unless a chained movement follows it. */
  const toggleSet = (item: ExerciseItem, s: LoggedSet) => {
    const done = !s.done
    const position = draft.sets.indexOf(s)
    const next = draft.sets[position + 1]
    const chainedFollows = next && next.item_id === s.item_id && next.chained && next.index === s.index
    setRow(s, { done }, done && !chainedFollows ? item.rest_s : undefined)
  }

  const finish = () => {
    const previous = data.training_logs
    const records = findRecords(draft.sets, previous, exercises)
    const rounds = Object.values(draft.circuits).reduce((a, b) => a + b, 0)
    const finisherDone = draft.wod_elapsed !== null || draft.wod_result.trim() !== ''
    const family = data.families.find((f) => f.name === 'Sport') ?? data.families.find((f) => f.stat_name === 'Force')
    const log: TrainingLog = {
      id: crypto.randomUUID(),
      session_id: session.id,
      discipline: session.discipline,
      name: session.name,
      day: today,
      started_at: draft.started_at,
      duration_s: Math.round(elapsed),
      feeling,
      note,
      warmup_done: draft.warmup_done,
      circuits: draft.circuits,
      sets: draft.sets,
      wod_id: draft.wod_id,
      wod_result: [draft.wod_elapsed !== null && wod?.format === 'for_time' ? clock(draft.wod_elapsed) : '', draft.wod_result.trim()].filter(Boolean).join(' · '),
      records,
      family_id: family?.id ?? null,
      xp_earned: sessionXp(draft.sets, draft.warmup_done, rounds, finisherDone),
    }
    save('training_logs', log)
    setDraft(null)
    onClose(log)
  }

  const doneSets = draft.sets.filter((s) => s.done)
  const totalSets = draft.sets.length

  const pickWod = (w: Wod | null) => update({ wod_id: w?.id ?? null, wod_started: null, wod_elapsed: null })

  return (
    <div className="flex flex-col gap-3 pb-32">
      <div className="sticky top-0 z-[5] -mx-5 flex flex-col gap-2 bg-ground px-5 pt-1 pb-2 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl">{session.name}</h1>
            <p className="text-[13px] text-muted tabular-nums">{clock(elapsed)} · {doneSets.length}/{totalSets} séries</p>
          </div>
          <Button variant="primary" onClick={() => setFinishing(true)}>Terminer</Button>
        </div>
        {draft.rest_end && draft.rest_end > now && (
          <RestBar end={draft.rest_end} now={now} onAdd={() => update({ rest_end: draft.rest_end! + 30_000 })} onSkip={() => update({ rest_end: null })} />
        )}
      </div>

      <section className="flex items-center gap-2 card p-3">
        <CheckButton done={draft.warmup_done} label={`Échauffement : ${session.warmup}`} onClick={() => update({ warmup_done: !draft.warmup_done })} />
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">Échauffement</p>
          <p className="font-medium">{session.warmup || 'Échauffement'}</p>
        </div>
      </section>

      {session.items.map((item) => {
        if (item.kind === 'circuit') {
          const rounds = draft.circuits[item.id] ?? 0
          return (
            <section key={item.id} className="card p-3">
              <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">Circuit · {item.rounds_min} à {item.rounds_max} tours</p>
              <p className="font-medium">{item.name}</p>
              <p className="text-[13px] text-muted">{item.content}</p>
              <div className="flex items-center gap-2 pt-2">
                <button type="button" aria-label="Retirer un tour" className="size-11 rounded-lg bg-chip text-xl" onClick={() => update({ circuits: { ...draft.circuits, [item.id]: Math.max(0, rounds - 1) } })}>−</button>
                <span className="min-w-24 text-center font-display text-xl font-semibold tabular-nums">{rounds} tour{rounds > 1 ? 's' : ''}</span>
                <button type="button" aria-label="Ajouter un tour" className="size-11 rounded-lg bg-chip text-xl" onClick={() => update({ circuits: { ...draft.circuits, [item.id]: rounds + 1 } })}>+</button>
              </div>
            </section>
          )
        }
        if (item.kind !== 'exercise') return null
        const exercise = exercises.find((e) => e.id === item.exercise_id)
        const rows = draft.sets.filter((s) => s.item_id === item.id)
        const last = lastSets(item.exercise_id, data.training_logs)
        const record = best.get(item.exercise_id)
        const allDone = rows.every((r) => r.done)
        return (
          <section key={item.id} className={`card p-3 ${allDone ? 'border-accent' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-base">{exercise?.name}</h2>
              <span className="text-[12px] text-muted">{exercise?.muscle}</span>
            </div>
            <p className="text-[13px] text-muted">
              {describeTargets(item)}{exercise?.unilateral ? ' · par côté' : ''}{item.note ? ` · ${item.note}` : ''}
            </p>
            {(last.length > 0 || (record && record.weight > 0)) && (
              <p className="text-[12px] text-muted">
                {last.length > 0 && `Dernière fois : ${last.map((s) => `${s.reps}${s.weight ? `×${s.weight}` : ''}`).join(', ')}`}
                {record && record.weight > 0 && ` · record ${record.weight} kg`}
              </p>
            )}
            <div className="mt-2 flex flex-col">
              {rows.map((s) => {
                const target = item.sets[s.index]
                const isRecord = s.done && !s.chained && record !== undefined && record.weight > 0 && (s.weight ?? 0) > record.weight
                return (
                  <div key={`${s.index}-${s.chained}`} className={`flex items-center gap-1.5 border-t border-line py-1 ${s.chained ? 'pl-6' : ''}`}>
                    <span className="w-20 flex-none text-[13px] text-muted">
                      {s.chained ? `↳ ${exerciseName(s.exercise_id).split(' ')[0]}` : `Série ${s.index + 1}`}
                      {!s.chained && target?.tempo && <span className="block text-[11px]">tempo</span>}
                      {!s.chained && target?.note && <span className="block text-[11px]">{target.note}</span>}
                    </span>
                    <input aria-label={`Répétitions, ${s.chained ? exerciseName(s.exercise_id) : `série ${s.index + 1}`}`} type="number" inputMode="numeric" min="0" className={numberInput} value={s.reps} onChange={(e) => setRow(s, { reps: Math.max(0, Number(e.target.value)) })} />
                    <span className="text-[13px] text-muted">×</span>
                    <input aria-label={`Charge en kg, ${s.chained ? exerciseName(s.exercise_id) : `série ${s.index + 1}`}`} type="number" inputMode="decimal" min="0" step="0.5" placeholder="kg" className={numberInput} value={s.weight ?? ''} onChange={(e) => setRow(s, { weight: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />
                    <span className="text-[13px] text-muted">kg</span>
                    <span className="flex-1 text-right text-[12px] font-semibold text-accent">{isRecord ? 'Record !' : ''}</span>
                    <CheckButton square done={s.done} label={`${s.done ? 'Annuler' : 'Valider'} la série ${s.index + 1} de ${exerciseName(s.exercise_id)}`} onClick={() => toggleSet(item, s)} />
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {session.finisher && (
        <section className="flex flex-col gap-2 card p-3">
          <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">Finisher · poids de corps</p>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Choisir le finisher" className={`${inputClass} !w-auto min-w-0 flex-1`} value={draft.wod_id ?? ''} onChange={(e) => pickWod(data.training_wods.find((w) => w.id === e.target.value) ?? null)}>
              <option value="">Choisir un WOD…</option>
              {data.training_wods.map((w) => <option key={w.id} value={w.id}>{w.name} · {WOD_FORMAT_LABELS[w.format]}</option>)}
            </select>
            <Button onClick={() => pickWod(randomWod(data.training_wods, draft.wod_id))}>Au hasard</Button>
          </div>
          {wod && (
            <>
              <div>
                <p className="font-medium">{wod.name}</p>
                <ul className="text-[13px] text-muted">{wod.items.map((i) => <li key={i}>• {i}</li>)}</ul>
                {wod.format === 'for_time' && wod.rounds > 1 && <p className="text-[13px] text-muted">{wod.rounds} tours</p>}
              </div>
              {draft.wod_elapsed === null ? (
                <WodTimer
                  wod={wod}
                  startedAt={draft.wod_started}
                  now={now}
                  onStart={() => update({ wod_started: Date.now() })}
                  onStop={(s) => update({ wod_started: null, wod_elapsed: s })}
                />
              ) : (
                <p className="rounded-lg bg-chip px-3 py-2 text-sm">Chrono : <strong className="tabular-nums">{clock(draft.wod_elapsed)}</strong></p>
              )}
              <input aria-label="Résultat du finisher" placeholder={wod.format === 'amrap' ? 'Résultat : nombre de tours' : 'Résultat ou remarque (facultatif)'} className={inputClass} value={draft.wod_result} onChange={(e) => update({ wod_result: e.target.value })} />
            </>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setFinishing(true)}>Terminer la séance</Button>
        {!confirmQuit && <Button onClick={() => setConfirmQuit(true)}>Abandonner…</Button>}
        {confirmQuit && (
          <>
            <Button className="!bg-warn !text-onaccent" onClick={() => { setDraft(null); onClose(null) }}>Abandonner sans enregistrer</Button>
            <Button onClick={() => setConfirmQuit(false)}>Continuer la séance</Button>
          </>
        )}
      </div>

      {finishing && (
        <div role="dialog" aria-label="Terminer la séance" className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-ground p-5">
            <h2 className="font-display text-lg">Fin de séance</h2>
            <p className="text-sm text-muted">
              {formatDuration(elapsed)} · {doneSets.length} séries · {Math.round(volume(draft.sets)).toLocaleString('fr-FR')} kg soulevés
            </p>
            <fieldset className="flex flex-col gap-1">
              <legend className="pb-1 text-sm font-medium">Ressenti</legend>
              <div className="flex gap-2">
                {(Object.keys(FEELING_LABELS) as Feeling[]).map((f) => (
                  <button key={f} type="button" aria-pressed={feeling === f} onClick={() => setFeeling(f)} className={`min-h-11 flex-1 rounded-lg text-sm font-medium ${feeling === f ? 'bg-accent text-onaccent' : 'bg-chip'}`}>{FEELING_LABELS[f]}</button>
                ))}
              </div>
            </fieldset>
            <textarea aria-label="Note sur la séance" placeholder="Une note (facultatif)" rows={2} className={`${inputClass} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="primary" onClick={finish}>Enregistrer la séance</Button>
            <Button onClick={() => setFinishing(false)}>Revenir à la séance</Button>
          </div>
        </div>
      )}
    </div>
  )
}
