import { useState, type FormEvent } from 'react'
import { Button, CheckButton, Dialog, Field, inputClass, ProgressBar, SectionTitle } from '../components/ui'
import { useStore } from '../data/store'
import { daysBetween, formatShortDay } from '../domain/date'
import {
  DANCE_XP,
  FIGURE_LABELS,
  GOAL_MEASURE_LABELS,
  goalProgress,
  STYLE_LABELS,
  type DanceFigure,
  type DanceGoal,
  type DanceStyle,
  type FigureStatus,
  type GoalMeasure,
} from './dance'
import { StyleDot, StylePicker } from './DanceUi'

const STATUSES: FigureStatus[] = ['to_learn', 'learning', 'mastered']

function FigureDialog({ figure, onClose }: { figure: DanceFigure; onClose: () => void }) {
  const { save, remove } = useStore()
  const [name, setName] = useState(figure.name)
  const [notes, setNotes] = useState(figure.notes)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    save('dance_figures', { ...figure, name: name.trim(), notes })
    onClose()
  }
  return (
    <Dialog title={figure.name} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nom">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Notes (étapes, comptes, points d'attention, lien vidéo…)">
          <textarea rows={5} className={`${inputClass} py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary">Enregistrer</Button>
        <Button onClick={() => { remove('dance_figures', figure.id); onClose() }}>Supprimer la figure</Button>
      </form>
    </Dialog>
  )
}

/** Figures per dance, from "to learn" to "mastered". Mastering one earns XP. */
export function DanceFigures() {
  const { data, save, today, track } = useStore()
  const [style, setStyle] = useState<DanceStyle>('bachata')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<DanceFigure | null>(null)
  const [cheer, setCheer] = useState<string | null>(null)
  const figures = data.dance_figures.filter((f) => f.style === style).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const worked = (id: string) => data.dance_sessions.filter((s) => s.status === 'done' && s.figure_ids.includes(id)).length

  const move = (f: DanceFigure, status: FigureStatus) => {
    const mastered = status === 'mastered'
    track(`${f.name} : ${FIGURE_LABELS[status].toLowerCase()}`, () =>
      save('dance_figures', { ...f, status, mastered_on: mastered ? today : null, xp_earned: mastered ? DANCE_XP.figure : 0 }),
    )
    setCheer(mastered ? `${f.name} maîtrisée ! +${DANCE_XP.figure} XP` : null)
  }
  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    save('dance_figures', { id: crypto.randomUUID(), style, name: name.trim(), status: 'to_learn', notes: '', mastered_on: null, xp_earned: 0 } satisfies DanceFigure)
    setName('')
  }

  return (
    <div className="flex flex-col gap-4">
      <StylePicker value={style} onChange={(s) => s && setStyle(s)} />
      {cheer && <p role="status" className="card border-accent p-3 text-center font-display text-lg">{cheer}</p>}
      <form onSubmit={add} className="flex gap-2">
        <input aria-label="Nouvelle figure" placeholder={`Nouvelle figure de ${STYLE_LABELS[style].toLowerCase()}`} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">Ajouter</Button>
      </form>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {STATUSES.map((status, i) => {
          const list = figures.filter((f) => f.status === status)
          return (
            <section key={status} className="card p-3">
              <h2 className="flex items-baseline justify-between pb-1 font-display text-base">
                {FIGURE_LABELS[status]}{status === 'mastered' ? 's' : ''}
                <span className="text-[13px] font-normal text-muted tabular-nums">{list.length}</span>
              </h2>
              {list.length === 0 && <p className="text-[13px] text-muted">—</p>}
              {list.map((f) => (
                <div key={f.id} className="flex items-center gap-1 border-t border-line py-1.5">
                  <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setEditing(f)}>
                    <span className="block font-medium">{f.name}</span>
                    <span className="block text-[12px] text-muted">
                      {[worked(f.id) ? `travaillée ${worked(f.id)} fois` : '', f.mastered_on ? `le ${formatShortDay(f.mastered_on)}` : '', f.notes ? 'notes' : ''].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                  {i > 0 && <button type="button" aria-label={`${f.name} : revenir à ${FIGURE_LABELS[STATUSES[i - 1]]}`} className="size-11 flex-none text-muted" onClick={() => move(f, STATUSES[i - 1])}>←</button>}
                  {i < 2 && (
                    <Button className="!min-h-9 !px-3 text-[13px]" variant={i === 1 ? 'primary' : 'ghost'} onClick={() => move(f, STATUSES[i + 1])}>
                      {i === 0 ? 'Je m’y mets' : 'Maîtrisée !'}
                    </Button>
                  )}
                </div>
              ))}
            </section>
          )
        })}
      </div>
      {editing && <FigureDialog figure={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function GoalDialog({ goal, onClose }: { goal: DanceGoal; onClose: () => void }) {
  const { data, save, remove } = useStore()
  const isNew = !data.dance_goals.some((g) => g.id === goal.id)
  const [draft, setDraft] = useState(goal)
  const [means, setMeans] = useState(goal.means.map((m) => m.text).join('\n'))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.title.trim()) return
    const lines = means.split('\n').map((l) => l.trim()).filter(Boolean)
    const kept = lines.map((text) => goal.means.find((m) => m.text === text) ?? { id: crypto.randomUUID(), text, done: false })
    save('dance_goals', { ...draft, title: draft.title.trim(), means: kept })
    onClose()
  }
  return (
    <Dialog title={isNew ? 'Nouvel objectif' : "Modifier l'objectif"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Objectif">
          <input className={inputClass} placeholder="ex. Maîtriser 5 nouvelles figures de bachata" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
        </Field>
        <StylePicker allowAll value={draft.style} onChange={(s) => setDraft({ ...draft, style: s })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ce qu'on compte">
            <select className={inputClass} value={draft.measure} onChange={(e) => setDraft({ ...draft, measure: e.target.value as GoalMeasure })}>
              {(Object.keys(GOAL_MEASURE_LABELS) as GoalMeasure[]).map((m) => <option key={m} value={m}>{GOAL_MEASURE_LABELS[m]}</option>)}
            </select>
          </Field>
          {draft.measure !== 'means' && (
            <Field label="Cible">
              <input type="number" min="1" className={inputClass} value={draft.target} onChange={(e) => setDraft({ ...draft, target: Math.max(1, Number(e.target.value)) })} />
            </Field>
          )}
          <Field label="Échéance (facultatif)">
            <input type="date" className={inputClass} value={draft.due_day ?? ''} onChange={(e) => setDraft({ ...draft, due_day: e.target.value || null })} />
          </Field>
        </div>
        <Field label="Les moyens d'y arriver (un par ligne)">
          <textarea rows={4} className={`${inputClass} py-2`} placeholder={'Pratiquer 15 min deux fois par semaine\nAller à 2 soirées par mois\nDemander un retour au prof'} value={means} onChange={(e) => setMeans(e.target.value)} />
        </Field>
        <p className="text-[13px] text-muted">La jauge compte à partir du {formatShortDay(draft.start_day)}.</p>
        <Button type="submit" variant="primary" disabled={!draft.title.trim()}>Enregistrer</Button>
        {!isNew && <Button onClick={() => { remove('dance_goals', goal.id); onClose() }}>Supprimer l'objectif</Button>}
      </form>
    </Dialog>
  )
}

/** Personal goals, each with a gauge and the concrete means to reach it. */
export function DanceGoals() {
  const { data, save, today } = useStore()
  const [editing, setEditing] = useState<DanceGoal | null>(null)
  const [newMean, setNewMean] = useState<Record<string, string>>({})
  const goals = [...data.dance_goals].sort((a, b) => Number(!!a.achieved_on) - Number(!!b.achieved_on) || (a.due_day ?? '9999').localeCompare(b.due_day ?? '9999'))

  const toggleMean = (goal: DanceGoal, id: string) => save('dance_goals', { ...goal, means: goal.means.map((m) => (m.id === id ? { ...m, done: !m.done } : m)) })
  const addMean = (goal: DanceGoal) => {
    const text = (newMean[goal.id] ?? '').trim()
    if (!text) return
    save('dance_goals', { ...goal, means: [...goal.means, { id: crypto.randomUUID(), text, done: false }] })
    setNewMean({ ...newMean, [goal.id]: '' })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Objectifs</SectionTitle>
        <Button variant="primary" onClick={() => setEditing({ id: crypto.randomUUID(), title: '', style: '', measure: 'figures', target: 5, start_day: today, due_day: null, means: [], achieved_on: null, xp_earned: 0 })}>
          Nouvel objectif
        </Button>
      </div>
      {goals.length === 0 && <p className="card p-4 text-muted">Fixe-toi un objectif, par exemple « Maîtriser 5 nouvelles figures de bachata d'ici mars », et liste les moyens d'y arriver.</p>}
      {goals.map((goal) => {
        const { value, target, ratio } = goalProgress(goal, data.dance_sessions, data.dance_figures)
        const daysLeft = goal.due_day ? daysBetween(today, goal.due_day) : null
        return (
          <section key={goal.id} className={`flex flex-col gap-2 card p-3 ${goal.achieved_on ? 'border-accent' : ''}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-display text-base">{goal.title}</p>
                <p className="flex items-center gap-1.5 text-[13px] text-muted">
                  {goal.style ? <><StyleDot style={goal.style} />{STYLE_LABELS[goal.style]} · </> : 'Toutes les danses · '}
                  {GOAL_MEASURE_LABELS[goal.measure]}
                  {goal.achieved_on ? ` · réussi le ${formatShortDay(goal.achieved_on)}` : daysLeft !== null ? (daysLeft >= 0 ? ` · encore ${daysLeft} j` : ' · échéance passée') : ''}
                </p>
              </div>
              <button type="button" className="min-h-11 px-2 text-[13px] text-muted" onClick={() => setEditing(goal)}>Modifier</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1"><ProgressBar percent={ratio * 100} /></div>
              <span className="text-sm font-medium tabular-nums">{value} / {target}</span>
            </div>
            {ratio >= 1 && !goal.achieved_on && (
              <Button variant="primary" onClick={() => save('dance_goals', { ...goal, achieved_on: today, xp_earned: DANCE_XP.goal })}>Objectif atteint ! +{DANCE_XP.goal} XP</Button>
            )}
            {(goal.means.length > 0 || !goal.achieved_on) && (
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
            )}
          </section>
        )
      })}
      {editing && <GoalDialog goal={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
