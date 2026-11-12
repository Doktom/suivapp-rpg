import { useState, type FormEvent } from 'react'
import { Button, CheckButton, Dialog, Field, inputClass, ProgressBar, SectionTitle } from '../components/ui'
import { useStore } from '../data/store'
import { daysBetween, formatShortDay } from '../domain/date'
import { GOAL_XP, SPORT_GOAL_LABELS, sportGoalProgress, type SportGoalMeasure, type TrainingGoal } from './achievements'

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
const needsExercise = (m: SportGoalMeasure) => m === 'weight' || m === 'reps'

function GoalDialog({ goal, onClose }: { goal: TrainingGoal; onClose: () => void }) {
  const { data, save, remove } = useStore()
  const isNew = !data.training_goals.some((g) => g.id === goal.id)
  const [draft, setDraft] = useState(goal)
  const [means, setMeans] = useState(goal.means.map((m) => m.text).join('\n'))
  const exercises = data.training_exercises.filter((e) => e.measure !== 'duration').sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const exerciseName = exercises.find((e) => e.id === draft.exercise_id)?.name ?? ''
  const placeholder =
    draft.measure === 'weight' ? `ex. ${exerciseName || 'Presse à cuisse'} à ${draft.target} kg` : draft.measure === 'sessions' ? `ex. ${draft.target} séances d'ici la fin du mois` : 'ex. Passer les 10 tonnes ce mois-ci'
  const invalid = !draft.title.trim() || (needsExercise(draft.measure) && !draft.exercise_id)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (invalid) return
    const lines = means.split('\n').map((l) => l.trim()).filter(Boolean)
    const kept = lines.map((text) => goal.means.find((m) => m.text === text) ?? { id: crypto.randomUUID(), text, done: false })
    save('training_goals', { ...draft, title: draft.title.trim(), exercise_id: needsExercise(draft.measure) ? draft.exercise_id : null, means: kept })
    onClose()
  }

  return (
    <Dialog title={isNew ? 'Nouvel objectif sport' : "Modifier l'objectif"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Ce qu'on mesure">
          <select className={inputClass} value={draft.measure} onChange={(e) => setDraft({ ...draft, measure: e.target.value as SportGoalMeasure })}>
            {(Object.keys(SPORT_GOAL_LABELS) as SportGoalMeasure[]).map((m) => <option key={m} value={m}>{SPORT_GOAL_LABELS[m]}</option>)}
          </select>
        </Field>
        {needsExercise(draft.measure) && (
          <Field label="Exercice">
            <select className={inputClass} value={draft.exercise_id ?? ''} onChange={(e) => setDraft({ ...draft, exercise_id: e.target.value || null })}>
              <option value="">Choisir…</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={draft.measure === 'weight' || draft.measure === 'volume' ? 'Cible (kg)' : 'Cible'}>
            <input type="number" min="1" step={draft.measure === 'weight' ? '0.5' : '1'} className={inputClass} value={draft.target} onChange={(e) => setDraft({ ...draft, target: Math.max(1, Number(e.target.value)) })} />
          </Field>
          <Field label="Échéance (facultatif)">
            <input type="date" className={inputClass} value={draft.due_day ?? ''} onChange={(e) => setDraft({ ...draft, due_day: e.target.value || null })} />
          </Field>
        </div>
        <Field label="Intitulé">
          <input className={inputClass} placeholder={placeholder} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
        </Field>
        <Field label="Les moyens d'y arriver (un par ligne)">
          <textarea rows={4} className={`${inputClass} py-2`} placeholder={'Ajouter 2,5 kg toutes les deux séances\nNe pas sauter la séance jambes\nDormir 8 h la veille'} value={means} onChange={(e) => setMeans(e.target.value)} />
        </Field>
        <p className="text-[13px] text-muted">
          {needsExercise(draft.measure) ? 'La jauge suit ta meilleure performance sur cet exercice.' : `La jauge compte à partir du ${formatShortDay(draft.start_day)}.`}
        </p>
        <Button type="submit" variant="primary" disabled={invalid}>Enregistrer</Button>
        {!isNew && <Button onClick={() => { remove('training_goals', goal.id); onClose() }}>Supprimer l'objectif</Button>}
      </form>
    </Dialog>
  )
}

/** Sport goals with a gauge and the concrete means to reach them. */
export function SportGoals() {
  const { data, save, today } = useStore()
  const [editing, setEditing] = useState<TrainingGoal | null>(null)
  const [newMean, setNewMean] = useState<Record<string, string>>({})
  const goals = [...data.training_goals].sort((a, b) => Number(!!a.achieved_on) - Number(!!b.achieved_on) || (a.due_day ?? '9999').localeCompare(b.due_day ?? '9999'))
  const logs = data.training_logs

  const toggleMean = (goal: TrainingGoal, id: string) => save('training_goals', { ...goal, means: goal.means.map((m) => (m.id === id ? { ...m, done: !m.done } : m)) })
  const addMean = (goal: TrainingGoal) => {
    const text = (newMean[goal.id] ?? '').trim()
    if (!text) return
    save('training_goals', { ...goal, means: [...goal.means, { id: crypto.randomUUID(), text, done: false }] })
    setNewMean({ ...newMean, [goal.id]: '' })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Objectifs sport</SectionTitle>
        <Button variant="primary" onClick={() => setEditing({ id: crypto.randomUUID(), title: '', measure: 'weight', exercise_id: null, target: 60, start_day: today, due_day: null, means: [], achieved_on: null, xp_earned: 0 })}>
          Nouvel objectif
        </Button>
      </div>
      {goals.length === 0 && <p className="card p-4 text-muted">Fixe-toi un cap, par exemple « Presse à cuisse à 120 kg » ou « 12 séances ce mois », et liste les moyens d'y arriver.</p>}
      {goals.map((goal) => {
        const { value, target, ratio } = sportGoalProgress(goal, logs)
        const daysLeft = goal.due_day ? daysBetween(today, goal.due_day) : null
        const exercise = data.training_exercises.find((e) => e.id === goal.exercise_id)
        const unit = goal.measure === 'weight' || goal.measure === 'volume' ? ' kg' : ''
        return (
          <section key={goal.id} className={`flex flex-col gap-2 card p-3 ${goal.achieved_on ? 'border-accent' : ''}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-display text-base">{goal.title}</p>
                <p className="text-[13px] text-muted">
                  {SPORT_GOAL_LABELS[goal.measure]}{exercise ? ` · ${exercise.name}` : ''}
                  {goal.achieved_on ? ` · réussi le ${formatShortDay(goal.achieved_on)}` : daysLeft !== null ? (daysLeft >= 0 ? ` · encore ${daysLeft} j` : ' · échéance passée') : ''}
                </p>
              </div>
              <button type="button" className="min-h-11 px-2 text-[13px] text-muted" onClick={() => setEditing(goal)}>Modifier</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1"><ProgressBar percent={ratio * 100} /></div>
              <span className="text-sm font-medium tabular-nums">{fmt(value)} / {fmt(target)}{unit}</span>
            </div>
            {ratio >= 1 && !goal.achieved_on && (
              <Button variant="primary" onClick={() => save('training_goals', { ...goal, achieved_on: today, xp_earned: GOAL_XP })}>Objectif atteint ! +{GOAL_XP} XP</Button>
            )}
            <div>
              <p className="text-[12px] font-semibold tracking-wide text-muted uppercase">Moyens d'y arriver</p>
              {goal.means.map((m) => (
                <div key={m.id} className="flex items-center gap-1">
                  <CheckButton square done={m.done} label={`${m.done ? 'Décocher' : 'Cocher'} : ${m.text}`} onClick={() => toggleMean(goal, m.id)} />
                  <span className={`min-w-0 flex-1 text-sm ${m.done ? 'text-muted line-through' : ''}`}>{m.text}</span>
                </div>
              ))}
              {!goal.achieved_on && (
                <form onSubmit={(e) => { e.preventDefault(); addMean(goal) }} className="pt-1 pl-[44px]">
                  <input aria-label={`Ajouter un moyen à ${goal.title}`} placeholder="Ajouter un moyen" className={inputClass} value={newMean[goal.id] ?? ''} onChange={(e) => setNewMean({ ...newMean, [goal.id]: e.target.value })} />
                </form>
              )}
            </div>
          </section>
        )
      })}
      {editing && <GoalDialog goal={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
