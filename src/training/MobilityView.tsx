import { useState, type FormEvent } from 'react'
import { Button, Dialog, Field, inputClass, SectionTitle } from '../components/ui'
import { useStore } from '../data/store'
import { addDays, formatShortDay, mondayOf } from '../domain/date'
import { LogDetail } from './LogDetail'
import { formatDuration } from './logic'
import { hold, importRoutineHabit, mobilitySession, mobilityStreak, mobilitySteps, routineSeconds } from './mobility'
import { ExerciseDialog } from './ProgramEditor'
import { CATEGORY_LABELS, type HoldItem, type MobilityCategory, type RoutineLevel, type TrainingLog, type TrainingSession } from './types'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MobilityCategory[]
const DAYS_SHOWN = 14
const small = 'size-11 flex-none text-muted disabled:opacity-30'
const LEVEL_PRESET: RoutineLevel[] = [
  { name: 'Rapide', detail: '', items: [] },
  { name: 'Normal', detail: '', items: [] },
  { name: 'Complet', detail: '', items: [] },
]

function RoutineDialog({ routine, onClose }: { routine: TrainingSession; onClose: () => void }) {
  const { data, save } = useStore()
  const [draft, setDraft] = useState(routine)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const exercises = [...data.training_exercises].filter((e) => e.measure === 'duration' || draft.items.some((i) => i.kind === 'hold' && i.exercise_id === e.id))
    .sort((a, b) => a.muscle.localeCompare(b.muscle, 'fr') || a.name.localeCompare(b.name, 'fr'))
  const items = draft.items.filter((i): i is HoldItem => i.kind === 'hold')
  const setItem = (id: string, patch: Partial<HoldItem>) => setDraft({ ...draft, items: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  const move = (index: number, delta: number) => {
    const next = [...items]
    ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
    setDraft({ ...draft, items: next })
  }
  const setLevel = (index: number, patch: Partial<RoutineLevel>) => setDraft({ ...draft, levels: draft.levels.map((l, i) => (i === index ? { ...l, ...patch } : l)) })
  const toggleLevelItem = (index: number, itemId: string) => {
    const level = draft.levels[index]
    setLevel(index, { items: level.items.includes(itemId) ? level.items.filter((x) => x !== itemId) : [...level.items, itemId] })
  }
  const name = (id: string) => data.training_exercises.find((e) => e.id === id)?.name ?? '?'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim() || items.length === 0) return
    const kept = items.map((i) => i.id)
    save('training_sessions', { ...draft, name: draft.name.trim(), items, levels: draft.levels.map((l) => ({ ...l, items: l.items.filter((x) => kept.includes(x)) })) })
    onClose()
  }

  return (
    <Dialog title={routine.name ? 'Modifier la routine' : 'Nouvelle routine'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <Field label="Nom">
            <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </Field>
          <Field label="Type">
            <select className={inputClass} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as MobilityCategory })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-[13px] text-muted">Durée en secondes pour une tenue, ou 0 et un nombre de répétitions. « 2 côtés » enchaîne gauche puis droite.</p>
        {items.map((item, index) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-surface p-2">
            <div className="flex items-center gap-1">
              <select aria-label="Exercice" className={inputClass} value={item.exercise_id} onChange={(e) => (e.target.value === '__new' ? setCreatingFor(item.id) : setItem(item.id, { exercise_id: e.target.value }))}>
                {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                <option value="__new">+ Nouvel exercice…</option>
              </select>
              <button type="button" aria-label="Monter" disabled={index === 0} className={small} onClick={() => move(index, -1)}>↑</button>
              <button type="button" aria-label="Descendre" disabled={index === items.length - 1} className={small} onClick={() => move(index, 1)}>↓</button>
              <button type="button" aria-label="Retirer" className={small} onClick={() => setDraft({ ...draft, items: items.filter((i) => i.id !== item.id) })}>×</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input aria-label="Durée de tenue en secondes" type="number" min="0" step="5" className={`${inputClass} !w-20 text-center`} value={item.hold_s} onChange={(e) => setItem(item.id, { hold_s: Math.max(0, Number(e.target.value)) })} />
              <span className="text-muted">s</span>
              {item.hold_s === 0 && (
                <>
                  <input aria-label="Répétitions" type="number" min="1" className={`${inputClass} !w-16 text-center`} value={item.reps || 10} onChange={(e) => setItem(item.id, { reps: Math.max(1, Number(e.target.value)) })} />
                  <span className="text-muted">reps</span>
                </>
              )}
              <label className="flex min-h-11 items-center gap-1.5">
                <input type="checkbox" className="size-5" checked={item.sides} onChange={(e) => setItem(item.id, { sides: e.target.checked })} />
                2 côtés
              </label>
              <input aria-label="Nombre de tours" type="number" min="1" className={`${inputClass} !w-16 text-center`} value={item.rounds} onChange={(e) => setItem(item.id, { rounds: Math.max(1, Number(e.target.value)) })} />
              <span className="text-muted">tour(s)</span>
            </div>
          </div>
        ))}
        <Button className="self-start" onClick={() => exercises[0] ? setDraft({ ...draft, items: [...items, hold(exercises[0].id, 30)] }) : setCreatingFor('__add')}>+ Exercice</Button>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1 text-sm font-medium">Niveaux (facultatif)</legend>
          {draft.levels.map((level, li) => (
            <div key={li} className="flex flex-col gap-1 rounded-lg bg-surface p-2">
              <div className="flex gap-2">
                <input aria-label={`Nom du niveau ${li + 1}`} className={inputClass} value={level.name} onChange={(e) => setLevel(li, { name: e.target.value })} />
                <input aria-label={`Durée du niveau ${li + 1}`} placeholder="ex. 5 min" className={inputClass} value={level.detail} onChange={(e) => setLevel(li, { detail: e.target.value })} />
                <button type="button" aria-label={`Retirer le niveau ${level.name}`} className={small} onClick={() => setDraft({ ...draft, levels: draft.levels.filter((_, i) => i !== li) })}>×</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <label key={item.id} className="flex min-h-9 items-center gap-1.5 rounded-md bg-chip px-2 text-[13px]">
                    <input type="checkbox" checked={level.items.includes(item.id)} onChange={() => toggleLevelItem(li, item.id)} />
                    {name(item.exercise_id)}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {draft.levels.length < 4 && <Button onClick={() => setDraft({ ...draft, levels: [...draft.levels, { name: `Niveau ${draft.levels.length + 1}`, detail: '', items: [] }] })}>Ajouter un niveau</Button>}
            {draft.levels.length === 0 && <Button onClick={() => setDraft({ ...draft, levels: LEVEL_PRESET })}>Rapide / Normal / Complet</Button>}
          </div>
          <p className="text-[13px] text-muted">Un niveau sans exercice coché les contient tous.</p>
        </fieldset>

        <Button type="submit" variant="primary" disabled={!draft.name.trim() || items.length === 0}>Enregistrer la routine</Button>
        {routine.name && <Button onClick={() => { save('training_sessions', { ...routine, archived: !routine.archived }); onClose() }}>{routine.archived ? 'Restaurer la routine' : 'Archiver la routine'}</Button>}
      </form>
      {creatingFor && (
        <ExerciseDialog
          exercise={null}
          defaultMeasure="duration"
          onClose={() => setCreatingFor(null)}
          onCreated={(e) => (creatingFor === '__add' ? setDraft({ ...draft, items: [...items, hold(e.id, 30)] }) : setItem(creatingFor, { exercise_id: e.id }))}
        />
      )}
    </Dialog>
  )
}

function Regularity({ logs, today }: { logs: TrainingLog[]; today: string }) {
  const streak = mobilityStreak(logs, today)
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, -(DAYS_SHOWN - 1 - i)))
  const doneDays = new Set(logs.map((l) => l.day))
  const week = logs.filter((l) => mondayOf(l.day) === mondayOf(today)).length
  return (
    <section className="card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-base">Régularité</h2>
        <span className="text-[13px] text-muted">Série : {streak} jour{streak > 1 ? 's' : ''}</span>
      </div>
      <p className="pb-2 text-sm"><strong className="tabular-nums">{week}</strong> routine{week > 1 ? 's' : ''} cette semaine</p>
      <div className="grid grid-cols-7 gap-1.5" aria-label={`Routines des ${DAYS_SHOWN} derniers jours`}>
        {days.map((d) => (
          <span key={d} title={`${formatShortDay(d)}${doneDays.has(d) ? ' : fait' : ''}`} className={`flex h-8 items-center justify-center rounded-md text-[11px] tabular-nums ${doneDays.has(d) ? 'bg-accent text-onaccent' : 'bg-track text-muted'} ${d === today ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : ''}`}>
            {Number(d.slice(8))}
          </span>
        ))}
      </div>
    </section>
  )
}

function RoutineCard({ routine, logs, onStart }: { routine: TrainingSession; logs: TrainingLog[]; onStart: (level: number | null) => void }) {
  const lastLog = logs.filter((l) => l.session_id === routine.id).sort((a, b) => a.started_at.localeCompare(b.started_at)).pop()
  // The level used last time, or the middle one.
  const lastLevel = lastLog ? routine.levels.findIndex((l) => lastLog.name.endsWith(` · ${l.name}`)) : -1
  const [level, setLevel] = useState<number | null>(routine.levels.length ? (lastLevel >= 0 ? lastLevel : Math.floor((routine.levels.length - 1) / 2)) : null)
  const steps = mobilitySteps(routine, level)
  const chip = (active: boolean) => `min-h-9 rounded-full px-3 text-[13px] font-medium ${active ? 'bg-accent text-onaccent' : 'bg-chip'}`
  return (
    <div className="flex flex-col gap-2 card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base">{routine.name}</p>
          <p className="text-[13px] text-muted">
            {steps.length} étapes · environ {Math.max(1, Math.round(routineSeconds(steps) / 60))} min
            {lastLog ? ` · dernière fois le ${formatShortDay(lastLog.day)}` : ''}
          </p>
        </div>
        <Button variant="primary" onClick={() => onStart(level)}>Commencer</Button>
      </div>
      {routine.levels.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Niveau">
          {routine.levels.map((l, i) => (
            <button key={i} type="button" aria-pressed={level === i} className={chip(level === i)} onClick={() => setLevel(i)}>
              {l.name}{l.detail ? ` · ${l.detail}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The Mobility section: routines by kind, regularity, history, editing, and importing old stretching habits. */
export function Mobility({ onStart }: { onStart: (routine: TrainingSession, level: number | null) => void }) {
  const { data, today, save } = useStore()
  const [editing, setEditing] = useState<TrainingSession | null>(null)
  const [detail, setDetail] = useState<TrainingLog | null>(null)
  const routines = data.training_sessions.filter((s) => s.discipline === 'mobility').sort((a, b) => a.position - b.position)
  const active = routines.filter((r) => !r.archived)
  const logs = data.training_logs.filter((l) => l.discipline === 'mobility')
  const history = [...logs].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 10)
  const nextPosition = Math.max(-1, ...routines.map((r) => r.position)) + 1
  // Only stretching-type routines: from the Souplesse family, or named like one (not skincare, for instance).
  const flexFamily = data.families.find((f) => f.name === 'Souplesse' || f.stat_name === 'Souplesse')?.id
  const isStretching = (h: (typeof data.habits)[number]) => h.family_id === flexFamily || /étir|mobil|soupl|kin[ée]/i.test(h.name)
  const importable = data.habits.filter((h) => h.tracking === 'routine' && !h.archived && h.steps.length > 0 && isStretching(h) && !routines.some((r) => r.name === h.name))

  const importHabit = (habitId: string) => {
    const habit = data.habits.find((h) => h.id === habitId)
    if (!habit) return
    const { exercises, session } = importRoutineHabit(habit, nextPosition)
    exercises.forEach((e) => save('training_exercises', e))
    save('training_sessions', session)
    save('habits', { ...habit, archived: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:items-start">
        <div className="flex flex-col gap-4">
          {CATEGORIES.map((c) => {
            const list = active.filter((r) => r.category === c)
            if (list.length === 0) return null
            return (
              <section key={c} className="flex flex-col gap-2">
                <h2 className="text-[12px] font-semibold tracking-wide text-muted uppercase">{CATEGORY_LABELS[c]}</h2>
                {list.map((r) => <RoutineCard key={r.id} routine={r} logs={logs} onStart={(level) => onStart(r, level)} />)}
              </section>
            )
          })}
          {active.length === 0 && <p className="text-muted">Aucune routine : crée la première ci-dessous.</p>}
        </div>
        <Regularity logs={logs} today={today} />
      </div>

      {importable.length > 0 && (
        <section className="card border-accent p-3">
          <h2 className="font-display text-base">Tes routines d'habitudes</h2>
          <p className="pb-2 text-[13px] text-muted">Elles passent ici, avec leurs étapes et leurs niveaux (30 s par étape, à ajuster). L'habitude est ensuite archivée : son historique est gardé.</p>
          {importable.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2">
              <span className="min-w-40 flex-1 font-medium">{h.name} <span className="text-[13px] font-normal text-muted">· {h.steps.length} étapes</span></span>
              <Button onClick={() => importHabit(h.id)}>Importer et archiver l'habitude</Button>
            </div>
          ))}
        </section>
      )}

      <section>
        <SectionTitle>Historique</SectionTitle>
        {history.length === 0 && <p className="border-t border-line py-4 text-muted">Pas encore de routine : lance-toi !</p>}
        {history.map((l) => (
          <button key={l.id} type="button" onClick={() => setDetail(l)} className="flex w-full flex-wrap items-center gap-x-3 border-t border-line py-2 text-left">
            <span className="w-16 text-[13px] text-muted">{formatShortDay(l.day)}</span>
            <span className="min-w-40 flex-1 font-medium">{l.name}</span>
            <span className="text-[13px] text-muted tabular-nums">{formatDuration(l.duration_s)} · {l.sets.filter((s) => s.done).length}/{l.sets.length} étapes</span>
            <span className="text-[13px] font-medium text-accent">+{l.xp_earned} XP</span>
          </button>
        ))}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 pb-2">
          <SectionTitle>Mes routines</SectionTitle>
          <Button onClick={() => setEditing(mobilitySession('', 'stretch', [], [], nextPosition))}>Nouvelle routine</Button>
        </div>
        {routines.map((r) => (
          <div key={r.id} className={`flex flex-wrap items-center gap-2 border-t border-line py-2 ${r.archived ? 'opacity-60' : ''}`}>
            <span className="min-w-40 flex-1">
              <span className="block font-medium">{r.name}</span>
              <span className="block text-[13px] text-muted">{r.category ? CATEGORY_LABELS[r.category] : ''} · {r.items.length} exercices{r.levels.length ? ` · ${r.levels.length} niveaux` : ''}{r.archived ? ' · archivée' : ''}</span>
            </span>
            <button type="button" className="min-h-11 px-2 text-[13px] text-muted" onClick={() => setEditing(r)}>Modifier</button>
          </div>
        ))}
      </section>

      {editing && <RoutineDialog routine={editing} onClose={() => setEditing(null)} />}
      {detail && <LogDetail log={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
