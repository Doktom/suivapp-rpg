import { useState, type FormEvent } from 'react'
import { Button, Dialog, Field, inputClass, SectionTitle } from '../components/ui'
import { useStore } from '../data/store'
import { addDays, firstOfMonth, formatLongDay, formatShortDay, mondayOf } from '../domain/date'
import {
  formatMinutes,
  KIND_LABELS,
  minutesBetween,
  minutesByStyle,
  sessionXp,
  STYLE_COLORS,
  STYLE_LABELS,
  STYLES,
  weekClasses,
  type DanceClass,
  type DanceKind,
  type DanceSession,
  type DanceStyle,
} from './dance'
import { DanceFigures, DanceGoals } from './DanceProgress'
import { StyleDot, StylePicker } from './DanceUi'

const WEEKDAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const HISTORY_SHOWN = 15

/** Adds or edits a class attended, a social (planned or done) or practice. */
function SessionDialog({ session, onClose }: { session: DanceSession; onClose: () => void }) {
  const { data, save, remove, today } = useStore()
  const [draft, setDraft] = useState(session)
  const isNew = !data.dance_sessions.some((s) => s.id === session.id)
  const figures = data.dance_figures.filter((f) => f.style === draft.style && f.status !== 'mastered')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // A future date is planned (shown in the agenda, confirmed afterwards); a past one is done.
    const status = draft.day > today ? 'planned' : draft.status === 'skipped' ? 'skipped' : 'done'
    const family = data.families.find((f) => f.name === 'Danse') ?? data.families.find((f) => f.stat_name === 'Grâce')
    save('dance_sessions', { ...draft, status, family_id: family?.id ?? null, xp_earned: status === 'done' ? sessionXp(draft.kind, draft.duration_min) : 0 })
    onClose()
  }
  const toggleFigure = (id: string) => setDraft({ ...draft, figure_ids: draft.figure_ids.includes(id) ? draft.figure_ids.filter((x) => x !== id) : [...draft.figure_ids, id] })

  return (
    <Dialog title={isNew ? (draft.kind === 'social' ? 'Soirée' : 'Noter une séance') : 'Modifier'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <StylePicker value={draft.style} onChange={(s) => s && setDraft({ ...draft, style: s, figure_ids: [] })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputClass} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DanceKind })}>
              {(Object.keys(KIND_LABELS) as DanceKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className={inputClass} value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })} required />
          </Field>
          <Field label="Heure (facultatif)">
            <input type="time" className={inputClass} value={draft.start_time ?? ''} onChange={(e) => setDraft({ ...draft, start_time: e.target.value || null })} />
          </Field>
          <Field label="Durée (min)">
            <input type="number" min="5" step="5" className={inputClass} value={draft.duration_min} onChange={(e) => setDraft({ ...draft, duration_min: Math.max(5, Number(e.target.value)) })} />
          </Field>
        </div>
        {draft.kind === 'social' && (
          <Field label="Nom ou lieu de la soirée">
            <input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
        )}
        {draft.kind === 'social' && draft.day > today && <p className="text-[13px] text-muted">Soirée à venir : elle s'affiche dans l'agenda, et tu confirmeras après coup.</p>}
        {figures.length > 0 && draft.day <= today && (
          <fieldset className="flex flex-col gap-1">
            <legend className="pb-1 text-sm font-medium">Figures travaillées</legend>
            <div className="flex flex-wrap gap-1.5">
              {figures.map((f) => (
                <label key={f.id} className="flex min-h-9 items-center gap-1.5 rounded-md bg-chip px-2 text-[13px]">
                  <input type="checkbox" checked={draft.figure_ids.includes(f.id)} onChange={() => toggleFigure(f.id)} />
                  {f.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Field label="Note (facultatif)">
          <textarea rows={2} className={`${inputClass} py-2`} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </Field>
        <Button type="submit" variant="primary">Enregistrer</Button>
        {!isNew && <Button onClick={() => { remove('dance_sessions', session.id); onClose() }}>Supprimer</Button>}
      </form>
    </Dialog>
  )
}

function ClassDialog({ danceClass, onClose }: { danceClass: DanceClass; onClose: () => void }) {
  const { data, save } = useStore()
  const [draft, setDraft] = useState(danceClass)
  const isNew = !data.dance_classes.some((c) => c.id === danceClass.id)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save('dance_classes', draft)
    onClose()
  }
  return (
    <Dialog title={isNew ? 'Nouveau cours fixe' : 'Modifier le cours'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <StylePicker value={draft.style} onChange={(s) => s && setDraft({ ...draft, style: s })} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Jour">
            <select className={inputClass} value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}>
              {WEEKDAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </Field>
          <Field label="Début">
            <input type="time" className={inputClass} value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} required />
          </Field>
          <Field label="Fin">
            <input type="time" className={inputClass} value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lieu / école">
            <input className={inputClass} value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} />
          </Field>
          <Field label="Niveau">
            <input className={inputClass} placeholder="ex. Intermédiaire" value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })} />
          </Field>
        </div>
        <Button type="submit" variant="primary">Enregistrer</Button>
        {!isNew && <Button onClick={() => { save('dance_classes', { ...danceClass, active: !danceClass.active }); onClose() }}>{danceClass.active ? 'Arrêter ce cours' : 'Reprendre ce cours'}</Button>}
      </form>
    </Dialog>
  )
}

function Week({ onEdit }: { onEdit: (s: DanceSession) => void }) {
  const { data, save, remove, today } = useStore()
  const sessions = data.dance_sessions
  const week = weekClasses(data.dance_classes, sessions, today, today)
  const monday = mondayOf(today)
  const weekMinutes = Object.values(minutesByStyle(sessions, monday, addDays(monday, 6))).reduce((a, b) => a + b, 0)
  const month = minutesByStyle(sessions, firstOfMonth(today), today)
  const monthTotal = Object.values(month).reduce((a, b) => a + b, 0)
  const socials = sessions.filter((s) => s.kind === 'social' && s.status === 'planned').sort((a, b) => a.day.localeCompare(b.day))
  const history = sessions.filter((s) => s.status === 'done').sort((a, b) => b.day.localeCompare(a.day) || (b.start_time ?? '').localeCompare(a.start_time ?? '')).slice(0, HISTORY_SHOWN)
  const family = data.families.find((f) => f.name === 'Danse') ?? data.families.find((f) => f.stat_name === 'Grâce')

  const attend = (w: (typeof week)[number]) => {
    if (w.session) return remove('dance_sessions', w.session.id)
    const minutes = minutesBetween(w.danceClass.start_time, w.danceClass.end_time)
    save('dance_sessions', {
      id: crypto.randomUUID(),
      style: w.danceClass.style,
      kind: 'class',
      day: w.day,
      start_time: w.danceClass.start_time,
      duration_min: minutes,
      status: 'done',
      class_id: w.danceClass.id,
      title: '',
      note: '',
      figure_ids: [],
      family_id: family?.id ?? null,
      xp_earned: sessionXp('class', minutes),
    } satisfies DanceSession)
  }
  const confirmSocial = (s: DanceSession, went: boolean) =>
    save('dance_sessions', { ...s, status: went ? 'done' : 'skipped', family_id: family?.id ?? null, xp_earned: went ? sessionXp('social', s.duration_min) : 0 })

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card p-3">
          <p className="text-[13px] text-muted">Cette semaine</p>
          <p className="font-display text-3xl">{formatMinutes(weekMinutes)}</p>
          <p className="text-[13px] text-muted">de danse</p>
        </div>
        <div className="card p-3">
          <p className="pb-1 text-[13px] text-muted">Ce mois-ci · {formatMinutes(monthTotal)}</p>
          {STYLES.map((s) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <StyleDot style={s} />
              <span className="w-20">{STYLE_LABELS[s]}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-track">
                <span className="block h-full rounded-full" style={{ width: `${monthTotal ? (month[s] / monthTotal) * 100 : 0}%`, background: STYLE_COLORS[s] }} />
              </span>
              <span className="w-16 text-right text-[13px] tabular-nums">{formatMinutes(month[s])}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Mes cours de la semaine</SectionTitle>
        {week.length === 0 && <p className="border-t border-line py-3 text-muted">Ajoute tes cours fixes dans « Cours fixes » : ils apparaîtront ici et dans l'agenda.</p>}
        {week.map((w) => (
          <div key={w.danceClass.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2">
            <StyleDot style={w.danceClass.style} />
            <div className="min-w-40 flex-1">
              <p className="font-medium">{STYLE_LABELS[w.danceClass.style]}{w.danceClass.level ? ` · ${w.danceClass.level}` : ''}</p>
              <p className={`text-[13px] ${w.state === 'missed' ? 'text-warn' : 'text-muted'}`}>
                {formatLongDay(w.day)} · {w.danceClass.start_time}–{w.danceClass.end_time}{w.danceClass.place ? ` · ${w.danceClass.place}` : ''}{w.state === 'missed' ? ' · manqué' : ''}
              </p>
            </div>
            {w.day <= today && (
              <Button variant={w.session ? 'ghost' : 'primary'} aria-pressed={!!w.session} onClick={() => attend(w)}>{w.session ? 'Présent·e ✓' : "J'y étais"}</Button>
            )}
          </div>
        ))}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <SectionTitle>Soirées</SectionTitle>
          <Button onClick={() => onEdit(newSession('social', addDays(today, 1)))}>Prévoir une soirée</Button>
        </div>
        {socials.length === 0 && <p className="border-t border-line py-3 text-muted">Aucune soirée prévue.</p>}
        {socials.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2">
            <StyleDot style={s.style} />
            <button type="button" className="min-w-40 flex-1 text-left" onClick={() => onEdit(s)}>
              <span className="block font-medium">{s.title || `Soirée ${STYLE_LABELS[s.style].toLowerCase()}`}</span>
              <span className="block text-[13px] text-muted">{formatLongDay(s.day)}{s.start_time ? ` · ${s.start_time}` : ''}</span>
            </button>
            {s.day <= today && (
              <>
                <Button variant="primary" onClick={() => confirmSocial(s, true)}>J'y suis allé·e</Button>
                <Button onClick={() => confirmSocial(s, false)}>Pas allé·e</Button>
              </>
            )}
          </div>
        ))}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <SectionTitle>Historique</SectionTitle>
          <Button variant="primary" onClick={() => onEdit(newSession('practice', today))}>Noter une séance</Button>
        </div>
        {history.length === 0 && <p className="border-t border-line py-3 text-muted">Rien de noté pour l'instant.</p>}
        {history.map((s) => (
          <button key={s.id} type="button" onClick={() => onEdit(s)} className="flex w-full flex-wrap items-center gap-x-3 border-t border-line py-2 text-left">
            <span className="w-16 text-[13px] text-muted">{formatShortDay(s.day)}</span>
            <StyleDot style={s.style} />
            <span className="min-w-32 flex-1 font-medium">{KIND_LABELS[s.kind]} · {STYLE_LABELS[s.style]}{s.title ? ` · ${s.title}` : ''}</span>
            <span className="text-[13px] text-muted tabular-nums">{formatMinutes(s.duration_min)}{s.figure_ids.length ? ` · ${s.figure_ids.length} figure${s.figure_ids.length > 1 ? 's' : ''}` : ''}</span>
            <span className="text-[13px] font-medium text-accent">+{s.xp_earned} XP</span>
          </button>
        ))}
      </section>
    </div>
  )
}

function newSession(kind: DanceKind, day: string, style: DanceStyle = 'salsa'): DanceSession {
  return { id: crypto.randomUUID(), style, kind, day, start_time: kind === 'social' ? '21:00' : null, duration_min: kind === 'social' ? 180 : 60, status: kind === 'social' ? 'planned' : 'done', class_id: null, title: '', note: '', figure_ids: [], family_id: null, xp_earned: 0 }
}

function Classes({ onEdit }: { onEdit: (c: DanceClass) => void }) {
  const { data } = useStore()
  const classes = [...data.dance_classes].sort((a, b) => Number(b.active) - Number(a.active) || a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
  return (
    <section>
      <div className="flex items-center justify-between gap-2 pb-1">
        <SectionTitle>Cours fixes</SectionTitle>
        <Button variant="primary" onClick={() => onEdit({ id: crypto.randomUUID(), style: 'salsa', weekday: 1, start_time: '20:00', end_time: '21:30', place: '', level: '', active: true })}>Ajouter un cours</Button>
      </div>
      <p className="pb-2 text-[13px] text-muted">Chaque semaine, ils apparaissent dans l'agenda ; un tap sur « J'y étais » les valide.</p>
      {classes.length === 0 && <p className="border-t border-line py-3 text-muted">Aucun cours fixe.</p>}
      {classes.map((c) => (
        <button key={c.id} type="button" onClick={() => onEdit(c)} className={`flex w-full items-center gap-2 border-t border-line py-2 text-left ${c.active ? '' : 'opacity-60'}`}>
          <StyleDot style={c.style} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{STYLE_LABELS[c.style]}{c.level ? ` · ${c.level}` : ''}</span>
            <span className="block text-[13px] text-muted">{WEEKDAY_NAMES[c.weekday]} · {c.start_time}–{c.end_time}{c.place ? ` · ${c.place}` : ''}{c.active ? '' : ' · arrêté'}</span>
          </span>
        </button>
      ))}
    </section>
  )
}

type DanceTab = 'week' | 'figures' | 'goals' | 'classes'
const TABS: [DanceTab, string][] = [
  ['week', 'Semaine'],
  ['figures', 'Figures'],
  ['goals', 'Objectifs'],
  ['classes', 'Cours fixes'],
]

export function Dance() {
  const [tab, setTab] = useState<DanceTab>('week')
  const [session, setSession] = useState<DanceSession | null>(null)
  const [danceClass, setDanceClass] = useState<DanceClass | null>(null)
  const chip = (active: boolean) => `min-h-9 rounded-full px-3 text-[13px] font-medium ${active ? 'bg-accent text-onaccent' : 'bg-chip'}`
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Vue">
        {TABS.map(([t, label]) => <button key={t} type="button" aria-pressed={tab === t} className={chip(tab === t)} onClick={() => setTab(t)}>{label}</button>)}
      </div>
      {tab === 'week' && <Week onEdit={setSession} />}
      {tab === 'figures' && <DanceFigures />}
      {tab === 'goals' && <DanceGoals />}
      {tab === 'classes' && <Classes onEdit={setDanceClass} />}
      {session && <SessionDialog session={session} onClose={() => setSession(null)} />}
      {danceClass && <ClassDialog danceClass={danceClass} onClose={() => setDanceClass(null)} />}
    </div>
  )
}
