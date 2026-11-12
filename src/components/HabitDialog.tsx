import { useState, type FormEvent } from 'react'
import { useStore, useToday } from '../data/store'
import {
  DEFAULT_LEVELS,
  MOMENT_LABELS,
  MOMENTS,
  TRACKING_LABELS,
  type Avoid,
  type Frequency,
  type Habit,
  type HabitShape,
  type Level,
  type Moment,
  type Step,
  type Tracking,
} from '../domain/types'
import { WEEKEND, WORKWEEK, weekdaysPreset } from '../domain/describe'
import { Button, Dialog, Field, inputClass } from './ui'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const WEEKDAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const MAX_LEVELS = 4
const TRACKINGS: Tracking[] = ['simple', 'levels', 'routine', 'avoid', 'duration', 'quantity']
const smallButton = 'size-11 flex-none text-muted disabled:opacity-30'

function LevelsEditor({ levels, steps, onChange }: { levels: Level[]; steps: Step[] | null; onChange: (levels: Level[]) => void }) {
  const update = (i: number, patch: Partial<Level>) => onChange(levels.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const toggleStep = (i: number, id: string) => {
    const current = levels[i].steps
    update(i, { steps: current.includes(id) ? current.filter((s) => s !== id) : [...current, id] })
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1 text-sm font-medium">Niveaux, du plus léger au plus complet</legend>
      {levels.map((level, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-lg bg-surface p-2">
          <div className="flex gap-2">
            <input aria-label={`Nom du niveau ${i + 1}`} className={inputClass} value={level.name} onChange={(e) => update(i, { name: e.target.value })} />
            <input aria-label={`Précision du niveau ${i + 1}`} placeholder="ex. 5 min" className={inputClass} value={level.detail} onChange={(e) => update(i, { detail: e.target.value })} />
            <button type="button" aria-label={`Retirer le niveau ${level.name}`} className={smallButton} onClick={() => onChange(levels.filter((_, j) => j !== i))}>×</button>
          </div>
          {steps && steps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {steps.map((s) => (
                <label key={s.id} className="flex min-h-9 items-center gap-1.5 rounded-md bg-chip px-2 text-[13px]">
                  <input type="checkbox" checked={level.steps.includes(s.id)} onChange={() => toggleStep(i, s.id)} />
                  {s.name || '(étape)'}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {levels.length < MAX_LEVELS && (
          <Button onClick={() => onChange([...levels, { name: `Niveau ${levels.length + 1}`, detail: '', steps: [] }])}>Ajouter un niveau</Button>
        )}
        {levels.length === 0 && <Button onClick={() => onChange(DEFAULT_LEVELS)}>Rapide / Normal / Complet</Button>}
      </div>
      {steps && <p className="text-[13px] text-muted">Sans niveau, la routine est validée quand toutes les étapes sont faites. Un niveau sans étape cochée les contient toutes.</p>}
    </fieldset>
  )
}

function StepsEditor({ steps, onChange }: { steps: Step[]; onChange: (steps: Step[]) => void }) {
  const move = (i: number, delta: number) => {
    const next = [...steps]
    ;[next[i], next[i + delta]] = [next[i + delta], next[i]]
    onChange(next)
  }
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="pb-1 text-sm font-medium">Étapes, dans l'ordre</legend>
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-1">
          <input aria-label={`Étape ${i + 1}`} className={inputClass} value={step.name} onChange={(e) => onChange(steps.map((s) => (s.id === step.id ? { ...s, name: e.target.value } : s)))} />
          <button type="button" aria-label={`Monter ${step.name}`} disabled={i === 0} className={smallButton} onClick={() => move(i, -1)}>↑</button>
          <button type="button" aria-label={`Descendre ${step.name}`} disabled={i === steps.length - 1} className={smallButton} onClick={() => move(i, 1)}>↓</button>
          <button type="button" aria-label={`Retirer ${step.name}`} className={smallButton} onClick={() => onChange(steps.filter((s) => s.id !== step.id))}>×</button>
        </div>
      ))}
      <Button className="self-start" onClick={() => onChange([...steps, { id: crypto.randomUUID().slice(0, 8), name: '' }])}>Ajouter une étape</Button>
    </fieldset>
  )
}

function AvoidEditor({ avoid, onChange }: { avoid: Avoid; onChange: (avoid: Avoid) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1 text-sm font-medium">Règle</legend>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seulement avant (facultatif)">
          <input type="time" className={inputClass} value={avoid.before ?? ''} onChange={(e) => onChange({ ...avoid, before: e.target.value || null })} />
        </Field>
        <Field label="Seulement après (facultatif)">
          <input type="time" className={inputClass} value={avoid.after ?? ''} onChange={(e) => onChange({ ...avoid, after: e.target.value || null })} />
        </Field>
        <Field label="Écarts tolérés">
          <input type="number" min="0" className={inputClass} value={avoid.tolerance} onChange={(e) => onChange({ ...avoid, tolerance: Math.max(0, Number(e.target.value)) })} />
        </Field>
        <Field label="Par">
          <select className={inputClass} value={avoid.period} onChange={(e) => onChange({ ...avoid, period: e.target.value as Avoid['period'] })}>
            <option value="day">Jour</option>
            <option value="week">Semaine</option>
          </select>
        </Field>
      </div>
      <p className="text-[13px] text-muted">La journée est tenue si les écarts ne dépassent pas la tolérance. Elle est validée automatiquement à la bascule de la journée, ou dès l'heure limite passée pour une règle « avant ».</p>
    </fieldset>
  )
}

export function HabitDialog({ habit, onClose }: { habit: Partial<Habit> | null; onClose: () => void }) {
  const { data, save, removeHabit } = useStore()
  const today = useToday()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const families = [...data.families].sort((a, b) => a.position - b.position)
  const existingId = habit?.id
  const [name, setName] = useState(habit?.name ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [familyId, setFamilyId] = useState(habit?.family_id ?? families[0]?.id ?? '')
  const [tracking, setTracking] = useState<Tracking>(habit?.tracking ?? 'simple')
  const [goal, setGoal] = useState(habit?.goal ?? 10)
  const [unit, setUnit] = useState(habit?.unit ?? '')
  const [levels, setLevels] = useState<Level[]>(habit?.levels ?? [])
  const [steps, setSteps] = useState<Step[]>(habit?.steps ?? [])
  const [avoid, setAvoid] = useState<Avoid>(habit?.avoid ?? { before: null, after: null, tolerance: 0, period: 'day' })
  const [frequency, setFrequency] = useState<Frequency>(habit?.frequency ?? { type: 'daily' })
  const [moments, setMoments] = useState<Moment[]>(habit?.moments ?? ['morning'])
  const [time, setTime] = useState(habit?.time_of_day ?? '')
  const [start, setStart] = useState(habit?.start_date ?? today)
  const [end, setEnd] = useState(habit?.end_date ?? '')

  const changeTracking = (t: Tracking) => {
    setTracking(t)
    if (t === 'levels' && levels.length === 0) setLevels(DEFAULT_LEVELS)
    if (t === 'avoid') setMoments(['day'])
  }

  const days = frequency.type === 'weekdays' ? frequency.days : []
  const invalid =
    moments.length === 0 ||
    (frequency.type === 'weekdays' && days.length === 0) ||
    ((tracking === 'duration' || tracking === 'quantity') && goal <= 0) ||
    (tracking === 'levels' && levels.length === 0) ||
    (tracking === 'routine' && steps.filter((s) => s.name.trim()).length === 0)

  const fields = (): HabitShape => {
    const cleanSteps = steps.filter((s) => s.name.trim()).map((s) => ({ ...s, name: s.name.trim() }))
    const kept = cleanSteps.map((s) => s.id)
    return {
      name: name.trim(),
      family_id: familyId || null,
      tracking,
      goal: tracking === 'duration' || tracking === 'quantity' ? goal : 1,
      unit: tracking === 'duration' ? 'min' : tracking === 'quantity' ? unit.trim() : '',
      frequency,
      moments: tracking === 'avoid' ? ['day'] : MOMENTS.filter((m) => moments.includes(m)),
      levels:
        tracking === 'levels' || tracking === 'routine'
          ? levels.map((l, i) => ({ name: l.name.trim() || `Niveau ${i + 1}`, detail: l.detail.trim(), steps: tracking === 'routine' ? l.steps.filter((id) => kept.includes(id)) : [] }))
          : [],
      steps: tracking === 'routine' ? cleanSteps : [],
      avoid: tracking === 'avoid' ? avoid : null,
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || invalid) return
    save('habits', {
      ...fields(),
      id: existingId ?? crypto.randomUUID(),
      description,
      time_of_day: time || null,
      start_date: start,
      end_date: end || null,
      pauses: habit?.pauses ?? [],
      archived: habit?.archived ?? false,
    } satisfies Habit)
    onClose()
  }

  const saveAsTemplate = () => {
    if (!name.trim() || invalid) return
    save('habit_templates', { ...fields(), id: crypto.randomUUID(), builtin: false })
    onClose()
  }

  const toggleMoment = (m: Moment) =>
    setMoments((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]))

  const toggleDay = (d: number) =>
    setFrequency({ type: 'weekdays', days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort() })

  /** "En semaine" and "Le week-end" are presets of the weekdays frequency. */
  type FrequencyChoice = Frequency['type'] | 'workweek' | 'weekend'
  const frequencyChoice: FrequencyChoice = frequency.type === 'weekdays' ? weekdaysPreset(frequency.days) ?? 'weekdays' : frequency.type

  const changeFrequency = (type: FrequencyChoice) => {
    if (type === 'workweek') setFrequency({ type: 'weekdays', days: WORKWEEK })
    else if (type === 'weekend') setFrequency({ type: 'weekdays', days: WEEKEND })
    else if (type === 'daily') setFrequency({ type })
    else if (type === 'weekdays') setFrequency({ type, days: [0, 2, 4] })
    else if (type === 'every_n') setFrequency({ type, interval: 2 })
    else setFrequency({ type, count: type === 'per_month' ? 4 : 3 })
  }

  return (
    <Dialog title={existingId ? 'Modifier la quête' : 'Nouvelle quête'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nom">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Famille">
          <select className={inputClass} value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
            {families.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Description (facultative)">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Suivi">
            <select className={inputClass} value={tracking} onChange={(e) => changeTracking(e.target.value as Tracking)}>
              {TRACKINGS.map((t) => <option key={t} value={t}>{TRACKING_LABELS[t]}</option>)}
            </select>
          </Field>
          {(tracking === 'duration' || tracking === 'quantity') && (
            <Field label={tracking === 'duration' ? 'Objectif (min)' : 'Objectif'}>
              <input type="number" min="1" className={inputClass} value={goal} onChange={(e) => setGoal(Number(e.target.value))} />
            </Field>
          )}
          {tracking === 'quantity' && (
            <Field label="Unité">
              <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pages" />
            </Field>
          )}
        </div>

        {tracking === 'routine' && <StepsEditor steps={steps} onChange={setSteps} />}
        {(tracking === 'levels' || tracking === 'routine') && (
          <LevelsEditor levels={levels} steps={tracking === 'routine' ? steps : null} onChange={setLevels} />
        )}
        {tracking === 'avoid' && <AvoidEditor avoid={avoid} onChange={setAvoid} />}

        <Field label="Fréquence">
          <select className={inputClass} value={frequencyChoice} onChange={(e) => changeFrequency(e.target.value as FrequencyChoice)}>
            <option value="daily">Tous les jours</option>
            <option value="workweek">En semaine (lundi → vendredi)</option>
            <option value="weekend">Le week-end (samedi et dimanche)</option>
            <option value="weekdays">Certains jours</option>
            <option value="per_week">X fois par semaine</option>
            <option value="per_month">X fois par mois</option>
            <option value="every_n">Tous les N jours</option>
          </select>
        </Field>
        {frequencyChoice === 'weekdays' && (
          <div className="flex justify-between">
            {WEEKDAYS.map((label, d) => (
              <button key={d} type="button" aria-label={WEEKDAY_NAMES[d]} aria-pressed={days.includes(d)} onClick={() => toggleDay(d)} className={`size-11 rounded-full text-sm font-medium ${days.includes(d) ? 'bg-accent text-onaccent' : 'bg-chip'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {frequency.type === 'per_week' && (
          <Field label="Nombre de fois par semaine">
            <input type="number" min="1" max="7" className={inputClass} value={frequency.count} onChange={(e) => setFrequency({ type: 'per_week', count: Number(e.target.value) })} />
          </Field>
        )}
        {frequency.type === 'per_month' && (
          <Field label="Nombre de fois par mois">
            <input type="number" min="1" max="31" className={inputClass} value={frequency.count} onChange={(e) => setFrequency({ type: 'per_month', count: Number(e.target.value) })} />
          </Field>
        )}
        {frequency.type === 'every_n' && (
          <Field label="Tous les combien de jours (à partir de la date de début)">
            <input type="number" min="2" className={inputClass} value={frequency.interval} onChange={(e) => setFrequency({ type: 'every_n', interval: Math.max(1, Number(e.target.value)) })} />
          </Field>
        )}

        {tracking !== 'avoid' && (
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-medium">Moments de la journée</legend>
            <div className="flex gap-2">
              {MOMENTS.map((m) => (
                <button key={m} type="button" aria-pressed={moments.includes(m)} onClick={() => toggleMoment(m)} className={`min-h-11 flex-1 rounded-lg text-sm font-medium ${moments.includes(m) ? 'bg-accent text-onaccent' : 'bg-chip'}`}>
                  {MOMENT_LABELS[m]}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Horaire">
            <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Début">
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="Fin">
            <input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        {moments.length === 0 && <p className="text-sm text-warn">Choisissez au moins un moment.</p>}
        {tracking === 'routine' && steps.every((s) => !s.name.trim()) && <p className="text-sm text-warn">Ajoutez au moins une étape.</p>}
        <Button type="submit" variant="primary" disabled={invalid}>Enregistrer</Button>
        <Button onClick={saveAsTemplate} disabled={invalid}>Enregistrer comme modèle</Button>
        {existingId && !confirmDelete && (
          <Button className="text-warn" onClick={() => setConfirmDelete(true)}>Supprimer la quête…</Button>
        )}
        {existingId && confirmDelete && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-warn p-3">
            <p className="text-sm">
              Supprimer « {habit?.name} » et tout son historique (validations, écarts, XP gagnée) ? C'est définitif. Pour simplement l'arrêter, utilisez plutôt « Archiver ».
            </p>
            <div className="flex gap-2">
              <Button className="!bg-warn !text-onaccent" onClick={() => { removeHabit(habit as Habit); onClose() }}>Supprimer définitivement</Button>
              <Button onClick={() => setConfirmDelete(false)}>Garder</Button>
            </div>
          </div>
        )}
      </form>
    </Dialog>
  )
}
