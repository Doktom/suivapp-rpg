import { useState, type FormEvent } from 'react'
import { Button, Dialog, Field, inputClass, SectionTitle } from '../components/ui'
import { useStore } from '../data/store'
import { formatPrescription, parsePrescription } from './stats'
import { PLACE_LABELS, type CircuitItem, type Exercise, type ExerciseItem, type Measure, type Place, type SessionItem, type TrainingSession } from './types'

const MEASURE_LABELS: Record<Measure, string> = { reps_weight: 'Répétitions × charge', reps: 'Répétitions seules', duration: 'Durée' }
const REST_CHOICES = [45, 60, 90, 120, 150, 180]
const small = 'size-11 flex-none text-muted disabled:opacity-30'

export function ExerciseDialog({ exercise, onClose, onCreated, defaultMeasure = 'reps_weight' }: {
  exercise: Exercise | null
  onClose: () => void
  onCreated?: (e: Exercise) => void
  defaultMeasure?: Measure
}) {
  const { save } = useStore()
  const [name, setName] = useState(exercise?.name ?? '')
  const [muscle, setMuscle] = useState(exercise?.muscle ?? '')
  const [measure, setMeasure] = useState<Measure>(exercise?.measure ?? defaultMeasure)
  const [unilateral, setUnilateral] = useState(exercise?.unilateral ?? false)
  const [notes, setNotes] = useState(exercise?.notes ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const row: Exercise = { id: exercise?.id ?? crypto.randomUUID(), name: name.trim(), muscle: muscle.trim(), measure, unilateral, notes }
    save('training_exercises', row)
    onCreated?.(row)
    onClose()
  }

  return (
    <Dialog title={exercise ? "Modifier l'exercice" : 'Nouvel exercice'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nom">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Muscle ou zone">
            <input className={inputClass} placeholder="ex. Pecs" value={muscle} onChange={(e) => setMuscle(e.target.value)} />
          </Field>
          <Field label="Mesure">
            <select className={inputClass} value={measure} onChange={(e) => setMeasure(e.target.value as Measure)}>
              {(Object.keys(MEASURE_LABELS) as Measure[]).map((m) => <option key={m} value={m}>{MEASURE_LABELS[m]}</option>)}
            </select>
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={unilateral} onChange={(e) => setUnilateral(e.target.checked)} />
          Unilatéral (répétitions par côté)
        </label>
        <Field label="Consignes (facultatif)">
          <textarea rows={3} className={`${inputClass} py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" disabled={!name.trim()}>Enregistrer</Button>
      </form>
    </Dialog>
  )
}

/** Edits a copy of the session; nothing is saved until "Enregistrer". */
function SessionDialog({ session, onClose }: { session: TrainingSession; onClose: () => void }) {
  const { data, save } = useStore()
  const [draft, setDraft] = useState<TrainingSession>(session)
  // Prescriptions are edited as text ("2x15 / 3x10 tempo") and read back on save.
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(session.items.filter((i): i is ExerciseItem => i.kind === 'exercise').map((i) => [i.id, formatPrescription(i.sets)])),
  )
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const exercises = [...data.training_exercises].sort((a, b) => a.muscle.localeCompare(b.muscle, 'fr') || a.name.localeCompare(b.name, 'fr'))
  const invalid = draft.items.filter((i) => i.kind === 'exercise' && !parsePrescription(texts[i.id] ?? '')).map((i) => i.id)

  const setItem = (id: string, patch: Partial<ExerciseItem> | Partial<CircuitItem>) =>
    setDraft({ ...draft, items: draft.items.map((i) => (i.id === id ? ({ ...i, ...patch } as SessionItem) : i)) })
  const move = (index: number, delta: number) => {
    const items = [...draft.items]
    ;[items[index], items[index + delta]] = [items[index + delta], items[index]]
    setDraft({ ...draft, items })
  }
  const addExercise = () => {
    const item: ExerciseItem = { id: crypto.randomUUID(), kind: 'exercise', exercise_id: exercises[0]?.id ?? '', sets: [], rest_s: 90, then: null, note: '' }
    setDraft({ ...draft, items: [...draft.items, item] })
    setTexts({ ...texts, [item.id]: '3x12' })
  }
  const addCircuit = () =>
    setDraft({ ...draft, items: [...draft.items, { id: crypto.randomUUID(), kind: 'circuit', name: 'Circuit', rounds_min: 3, rounds_max: 4, content: '' }] })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim() || invalid.length > 0) return
    const items = draft.items
      .filter((i) => i.kind === 'circuit' || i.exercise_id)
      .map((i) => (i.kind === 'exercise' ? { ...i, sets: parsePrescription(texts[i.id])! } : i))
    save('training_sessions', { ...draft, name: draft.name.trim(), items })
    onClose()
  }

  return (
    <Dialog title={session.name ? 'Modifier la séance' : 'Nouvelle séance'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nom">
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lieu">
            <select className={inputClass} value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value as Place })}>
              {(Object.keys(PLACE_LABELS) as Place[]).map((p) => <option key={p} value={p}>{PLACE_LABELS[p]}</option>)}
            </select>
          </Field>
          <Field label="Échauffement">
            <input className={inputClass} value={draft.warmup} onChange={(e) => setDraft({ ...draft, warmup: e.target.value })} />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={draft.finisher} onChange={(e) => setDraft({ ...draft, finisher: e.target.checked })} />
          Finisher en fin de séance
        </label>

        <p className="text-[13px] text-muted">Séries : « 3x15 », « 2x15 / 3x10 tempo », « 2x25 à vide / 2x20 ». Pour un exercice unilatéral, les répétitions sont par côté.</p>
        {draft.items.map((item, index) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-surface p-2">
            <div className="flex items-center gap-1">
              <span className="flex-1 text-[12px] font-semibold tracking-wide text-muted uppercase">{item.kind === 'circuit' ? 'Circuit' : `Exercice ${index + 1}`}</span>
              <button type="button" aria-label="Monter" disabled={index === 0} className={small} onClick={() => move(index, -1)}>↑</button>
              <button type="button" aria-label="Descendre" disabled={index === draft.items.length - 1} className={small} onClick={() => move(index, 1)}>↓</button>
              <button type="button" aria-label="Retirer" className={small} onClick={() => setDraft({ ...draft, items: draft.items.filter((i) => i.id !== item.id) })}>×</button>
            </div>
            {item.kind === 'exercise' ? (
              <>
                <div className="flex gap-2">
                  <select aria-label="Exercice" className={inputClass} value={item.exercise_id} onChange={(e) => (e.target.value === '__new' ? setCreatingFor(item.id) : setItem(item.id, { exercise_id: e.target.value }))}>
                    {exercises.map((e) => <option key={e.id} value={e.id}>{e.muscle ? `${e.muscle} · ` : ''}{e.name}</option>)}
                    <option value="__new">+ Nouvel exercice…</option>
                  </select>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input aria-label="Séries" aria-invalid={invalid.includes(item.id)} className={`${inputClass} ${invalid.includes(item.id) ? '!border-warn' : ''}`} value={texts[item.id] ?? ''} onChange={(e) => setTexts({ ...texts, [item.id]: e.target.value })} />
                  <select aria-label="Repos" className={`${inputClass} !w-auto`} value={item.rest_s} onChange={(e) => setItem(item.id, { rest_s: Number(e.target.value) })}>
                    {REST_CHOICES.map((s) => <option key={s} value={s}>repos {s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60}` : ''}` : `${s} s`}</option>)}
                  </select>
                </div>
                {invalid.includes(item.id) && <p className="text-[13px] text-warn">Séries illisibles : écris par exemple « 3x15 » ou « 2x15 / 3x10 ».</p>}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">Enchaîner avec</span>
                  <select aria-label="Mouvement enchaîné" className={`${inputClass} !w-auto min-w-0 flex-1`} value={item.then?.exercise_id ?? ''} onChange={(e) => setItem(item.id, { then: e.target.value ? { exercise_id: e.target.value, reps: item.then?.reps ?? 10, on: item.then?.on ?? 'each' } : null })}>
                    <option value="">rien</option>
                    {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  {item.then && (
                    <>
                      <input aria-label="Répétitions enchaînées" type="number" min="1" className={`${inputClass} !w-16 text-center`} value={item.then.reps} onChange={(e) => setItem(item.id, { then: { ...item.then!, reps: Math.max(1, Number(e.target.value)) } })} />
                      <select aria-label="Quand enchaîner" className={`${inputClass} !w-auto`} value={item.then.on} onChange={(e) => setItem(item.id, { then: { ...item.then!, on: e.target.value as 'each' | 'last' } })}>
                        <option value="each">à chaque série</option>
                        <option value="last">sur la dernière série</option>
                      </select>
                    </>
                  )}
                </div>
                <input aria-label="Remarque" placeholder="Remarque (facultatif)" className={inputClass} value={item.note} onChange={(e) => setItem(item.id, { note: e.target.value })} />
              </>
            ) : item.kind === 'circuit' ? (
              <>
                <input aria-label="Nom du circuit" className={inputClass} value={item.name} onChange={(e) => setItem(item.id, { name: e.target.value })} />
                <div className="flex items-center gap-2 text-sm">
                  <input aria-label="Tours minimum" type="number" min="1" className={`${inputClass} !w-16 text-center`} value={item.rounds_min} onChange={(e) => setItem(item.id, { rounds_min: Math.max(1, Number(e.target.value)) })} />
                  à
                  <input aria-label="Tours maximum" type="number" min="1" className={`${inputClass} !w-16 text-center`} value={item.rounds_max} onChange={(e) => setItem(item.id, { rounds_max: Math.max(1, Number(e.target.value)) })} />
                  tours
                </div>
                <input aria-label="Contenu du circuit" placeholder="Exercices du circuit" className={inputClass} value={item.content} onChange={(e) => setItem(item.id, { content: e.target.value })} />
              </>
            ) : null}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button onClick={addExercise}>+ Exercice</Button>
          <Button onClick={addCircuit}>+ Circuit</Button>
        </div>
        <Button type="submit" variant="primary" disabled={!draft.name.trim() || invalid.length > 0}>Enregistrer la séance</Button>
      </form>
      {creatingFor && (
        <ExerciseDialog exercise={null} onClose={() => setCreatingFor(null)} onCreated={(e) => setItem(creatingFor, { exercise_id: e.id })} />
      )}
    </Dialog>
  )
}

/** The program (sessions in rotation order) and the exercise library. */
export function ProgramEditor() {
  const { data, save } = useStore()
  const [editing, setEditing] = useState<TrainingSession | null>(null)
  const [editingExercise, setEditingExercise] = useState<Exercise | null | 'new'>(null)
  const sessions = data.training_sessions.filter((s) => s.discipline === 'sport').sort((a, b) => Number(a.archived) - Number(b.archived) || a.position - b.position)
  const active = sessions.filter((s) => !s.archived)
  const exercises = [...data.training_exercises].sort((a, b) => a.muscle.localeCompare(b.muscle, 'fr') || a.name.localeCompare(b.name, 'fr'))
  const used = (id: string) => data.training_sessions.some((s) => s.items.some((i) => i.kind === 'exercise' && (i.exercise_id === id || i.then?.exercise_id === id)))

  const move = (index: number, delta: number) => {
    const a = active[index]
    const b = active[index + delta]
    save('training_sessions', { ...a, position: b.position })
    save('training_sessions', { ...b, position: a.position })
  }
  const create = () =>
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      discipline: 'sport',
      place: 'gym',
      position: Math.max(-1, ...sessions.map((s) => s.position)) + 1,
      warmup: 'Échauffement articulaire',
      items: [],
      finisher: true,
      archived: false,
      category: '',
      levels: [],
    })

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex items-center justify-between gap-3 pb-2">
          <SectionTitle>Séances</SectionTitle>
          <Button onClick={create}>Nouvelle séance</Button>
        </div>
        <p className="pb-2 text-[13px] text-muted">Les séances de salle tournent dans cet ordre.</p>
        {sessions.map((s) => {
          const index = active.indexOf(s)
          return (
            <div key={s.id} className={`flex flex-wrap items-center gap-2 border-t border-line py-2 ${s.archived ? 'opacity-60' : ''}`}>
              <div className="min-w-40 flex-1">
                <p className="font-medium">{s.name}</p>
                <p className="text-[13px] text-muted">{PLACE_LABELS[s.place]} · {s.items.filter((i) => i.kind === 'exercise').length} exercices{s.archived ? ' · archivée' : ''}</p>
              </div>
              {!s.archived && (
                <>
                  <button type="button" aria-label={`Monter ${s.name}`} disabled={index === 0} className={small} onClick={() => move(index, -1)}>↑</button>
                  <button type="button" aria-label={`Descendre ${s.name}`} disabled={index === active.length - 1} className={small} onClick={() => move(index, 1)}>↓</button>
                </>
              )}
              <button type="button" className="min-h-11 px-2 text-[13px] text-muted" onClick={() => setEditing(s)}>Modifier</button>
              <button type="button" className="min-h-11 px-2 text-[13px] text-muted" onClick={() => save('training_sessions', { ...s, archived: !s.archived })}>{s.archived ? 'Restaurer' : 'Archiver'}</button>
            </div>
          )
        })}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 pb-2">
          <SectionTitle>Exercices</SectionTitle>
          <Button onClick={() => setEditingExercise('new')}>Nouvel exercice</Button>
        </div>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {exercises.map((e) => (
            <button key={e.id} type="button" onClick={() => setEditingExercise(e)} className="flex min-h-11 items-center gap-2 border-t border-line py-1.5 text-left">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{e.name}</span>
                <span className="block text-[12px] text-muted">{[e.muscle, e.unilateral ? 'unilatéral' : '', used(e.id) ? '' : 'hors programme'].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {editing && <SessionDialog session={editing} onClose={() => setEditing(null)} />}
      {editingExercise && <ExerciseDialog exercise={editingExercise === 'new' ? null : editingExercise} onClose={() => setEditingExercise(null)} />}
    </div>
  )
}
