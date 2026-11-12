import { useMemo, useState, type FormEvent } from 'react'
import { Button, Dialog, Field, inputClass, ProgressBar, SectionTitle } from '../components/ui'
import { useStore } from '../data/store'
import { addDays, formatShortDay, mondayOf } from '../domain/date'
import { unlockSound } from './chrono'
import { BADGE_XP, computeBadges, recordFeed } from './achievements'
import { LogDetail } from './LogDetail'
import { SportGoals } from './SportGoals'
import { RecordFeed, WeekStrip } from './Trophies'
import { draftSets, formatDuration, nextSession, rotation, volume } from './logic'
import { ProgramEditor } from './ProgramEditor'
import { ProgressView } from './ProgressView'
import { MobilityRunner, readMobilityDraft, startMobility, writeMobilityDraft, type MobilityDraft } from './MobilityRunner'
import { Dance } from './DanceView'
import { Mobility } from './MobilityView'
import { readDraft, SessionRunner, writeDraft, type Draft } from './SessionRunner'
import { FEELING_LABELS, WOD_FORMAT_LABELS, type Discipline, type TrainingLog, type TrainingSession, type Wod, type WodFormat } from './types'

type Section = Discipline
const SECTIONS: [Section, string][] = [
  ['sport', 'Sport'],
  ['mobility', 'Mobilité'],
  ['dance', 'Danse'],
]

/** Sessions per week aimed at, for the regularity view. */
const WEEKLY_TARGET = 3
const WEEKS_SHOWN = 8

function startDraft(session: TrainingSession, logs: TrainingLog[]): Draft {
  return {
    session_id: session.id,
    started_at: new Date().toISOString(),
    sets: draftSets(session, logs),
    warmup_done: false,
    circuits: {},
    wod_id: null,
    wod_started: null,
    wod_elapsed: null,
    wod_result: '',
    rest_end: null,
  }
}

function Regularity({ logs, today }: { logs: TrainingLog[]; today: string }) {
  const thisWeek = mondayOf(today)
  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, i) => addDays(thisWeek, -7 * (WEEKS_SHOWN - 1 - i)))
  const count = (week: string) => logs.filter((l) => mondayOf(l.day) === week).length
  // Weeks in a row with at least target − 1 sessions (one missed session is forgiven), not counting the week in progress.
  let streak = 0
  for (let w = addDays(thisWeek, -7); count(w) >= WEEKLY_TARGET - 1; w = addDays(w, -7)) streak++
  if (count(thisWeek) >= WEEKLY_TARGET - 1) streak++
  const done = count(thisWeek)
  return (
    <section className="card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-base">Régularité</h2>
        <span className="text-[13px] text-muted">Série : {streak} semaine{streak > 1 ? 's' : ''}</span>
      </div>
      <p className="pb-2 text-sm">
        <strong className="tabular-nums">{done}</strong> / {WEEKLY_TARGET} séances cette semaine
      </p>
      <ProgressBar percent={(done / WEEKLY_TARGET) * 100} />
      <div className="flex items-end gap-1.5 pt-3" aria-label={`Séances des ${WEEKS_SHOWN} dernières semaines`}>
        {weeks.map((w) => {
          const n = count(w)
          return (
            <div key={w} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-12 w-full flex-col-reverse gap-0.5">
                {Array.from({ length: Math.max(n, WEEKLY_TARGET) }, (_, i) => (
                  <span key={i} className={`h-full rounded-sm ${i < n ? 'bg-accent' : 'bg-track'}`} />
                ))}
              </div>
              <span className="text-[10px] text-muted">{formatShortDay(w).replace(/\s.*/, '')}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function WodDialog({ wod, onClose }: { wod: Wod | null; onClose: () => void }) {
  const { save, remove } = useStore()
  const [name, setName] = useState(wod?.name ?? '')
  const [format, setFormat] = useState<WodFormat>(wod?.format ?? 'amrap')
  const [minutes, setMinutes] = useState(wod?.minutes ?? 8)
  const [rounds, setRounds] = useState(wod?.rounds ?? 3)
  const [items, setItems] = useState((wod?.items ?? []).join('\n'))
  const lines = items.split('\n').map((l) => l.trim()).filter(Boolean)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || lines.length === 0) return
    save('training_wods', { id: wod?.id ?? crypto.randomUUID(), name: name.trim(), format, minutes, rounds: format === 'tabata' ? Math.max(1, rounds) : rounds, items: lines, builtin: wod?.builtin ?? false } satisfies Wod)
    onClose()
  }

  return (
    <Dialog title={wod ? 'Modifier le finisher' : 'Nouveau finisher'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nom">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Format">
            <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value as WodFormat)}>
              {(Object.keys(WOD_FORMAT_LABELS) as WodFormat[]).map((f) => <option key={f} value={f}>{WOD_FORMAT_LABELS[f]}</option>)}
            </select>
          </Field>
          {format !== 'tabata' && (
            <Field label={format === 'for_time' ? 'Limite (min)' : 'Durée (min)'}>
              <input type="number" min="1" className={inputClass} value={minutes} onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))} />
            </Field>
          )}
          {(format === 'for_time' || format === 'tabata') && (
            <Field label="Tours">
              <input type="number" min="1" className={inputClass} value={rounds} onChange={(e) => setRounds(Math.max(1, Number(e.target.value)))} />
            </Field>
          )}
        </div>
        <Field label="Exercices (un par ligne)">
          <textarea rows={5} className={`${inputClass} py-2`} value={items} onChange={(e) => setItems(e.target.value)} />
        </Field>
        {format === 'tabata' && <p className="text-[13px] text-muted">Tabata : 20 s d'effort, 10 s de repos, pour chaque tour.</p>}
        <Button type="submit" variant="primary" disabled={!name.trim() || lines.length === 0}>Enregistrer</Button>
        {wod && <Button onClick={() => { remove('training_wods', wod.id); onClose() }}>Supprimer ce finisher</Button>}
      </form>
    </Dialog>
  )
}

function Celebration({ log, onClose }: { log: TrainingLog; onClose: () => void }) {
  const { data } = useStore()
  const records = recordFeed(data.training_logs, data.training_exercises).filter((r) => r.logId === log.id)
  // Badges this session unlocked: those not unlocked without it.
  const won = useMemo(() => {
    const before = new Set(computeBadges({ ...data, training_logs: data.training_logs.filter((l) => l.id !== log.id) }).filter((b) => b.unlocked_on).map((b) => b.id))
    return computeBadges(data).filter((b) => b.unlocked_on && !before.has(b.id))
  }, [data, log.id])
  return (
    <section role="status" className="card anim-drop flex flex-col items-center gap-2 p-5 text-center" style={{ background: 'color-mix(in srgb, var(--color-gold) 20%, var(--color-surface))' }}>
      <p className="font-display text-2xl">{log.discipline === 'mobility' ? 'Routine bouclée !' : 'Donjon nettoyé !'}</p>
      <p className="text-sm text-muted">
        {log.name} · {formatDuration(log.duration_s)} ·{' '}
        {log.discipline === 'mobility'
          ? `${log.sets.filter((s) => s.done).length} étape${log.sets.filter((s) => s.done).length > 1 ? 's' : ''}`
          : `${Math.round(volume(log.sets)).toLocaleString('fr-FR')} kg`}
      </p>
      <p className="sticker !px-4 !py-1 font-display !text-2xl">+{log.xp_earned} XP de butin</p>
      {records.length > 0 && (
        <div className="w-full rounded-xl border-2 border-outline bg-teal p-3 text-onsticker">
          <p className="font-display text-lg">{records.length === 1 ? 'Nouveau record !' : `${records.length} nouveaux records !`}</p>
          {records.map((r) => (
            <p key={r.exercise.id} className="text-sm">
              {r.exercise.name} : <strong className="tabular-nums">{r.value.toLocaleString('fr-FR')} {r.unit}</strong>{' '}
              <span className="font-extrabold tabular-nums">(+{(r.value - r.previous).toLocaleString('fr-FR')} {r.unit})</span>
            </p>
          ))}
        </div>
      )}
      {won.map((b) => (
        <div key={b.id} className="w-full rounded-xl border-2 border-outline bg-surface p-3">
          <p className="text-[12px] font-extrabold tracking-wide uppercase">🏅 Badge débloqué · +{BADGE_XP} XP</p>
          <p className="font-display text-lg">{b.title}</p>
          <p className="text-sm text-muted">{b.description}</p>
        </div>
      ))}
      <Button variant="primary" className="self-center" onClick={onClose}>Continuer</Button>
    </section>
  )
}

function SessionCard({ session, logs, onStart, highlight }: { session: TrainingSession; logs: TrainingLog[]; onStart: () => void; highlight: boolean }) {
  const { data } = useStore()
  const [open, setOpen] = useState(false)
  const last = logs.filter((l) => l.session_id === session.id).sort((a, b) => a.started_at.localeCompare(b.started_at)).pop()
  const exerciseCount = session.items.filter((i) => i.kind === 'exercise').length
  return (
    <div className={`card p-3 ${highlight ? 'border-accent' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          {highlight && <p className="text-[12px] font-semibold tracking-wide text-accent uppercase">Prochaine séance</p>}
          <p className="font-display text-base">{session.name}</p>
          <p className="text-[13px] text-muted">
            {session.warmup} · {exerciseCount} exercices{session.finisher ? ' · finisher' : ''}
            {last ? ` · dernière fois le ${formatShortDay(last.day)}` : ''}
          </p>
        </div>
        <button type="button" className="min-h-11 px-2 text-[13px] text-muted" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Masquer' : 'Détail'}</button>
        <Button variant={highlight ? 'primary' : 'ghost'} onClick={onStart}>Commencer</Button>
      </div>
      {open && (
        <ul className="mt-2 border-t border-line pt-2 text-sm">
          {session.items.map((item) => (
            <li key={item.id} className="py-0.5">
              {item.kind === 'circuit'
                ? `${item.name} · ${item.rounds_min} à ${item.rounds_max} tours`
                : item.kind === 'exercise'
                  ? `${data.training_exercises.find((e) => e.id === item.exercise_id)?.name} · ${item.sets.length} séries${item.then ? ` + ${data.training_exercises.find((e) => e.id === item.then!.exercise_id)?.name}` : ''}`
                  : data.training_exercises.find((e) => e.id === item.exercise_id)?.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type SportView = 'sessions' | 'progress' | 'goals' | 'program'
const SPORT_VIEWS: [SportView, string][] = [
  ['sessions', 'Séances'],
  ['progress', 'Progression'],
  ['goals', 'Objectifs'],
  ['program', 'Programme'],
]
const HISTORY_SHOWN = 15

function Sport({ onStart }: { onStart: (s: TrainingSession) => void }) {
  const { data } = useStore()
  const [view, setView] = useState<SportView>('sessions')
  const logs = data.training_logs.filter((l) => l.discipline === 'sport')
  const chip = (active: boolean) => `min-h-9 rounded-full px-3 text-[13px] font-medium ${active ? 'bg-accent text-onaccent' : 'bg-chip'}`
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Vue">
        {SPORT_VIEWS.map(([v, label]) => (
          <button key={v} type="button" aria-pressed={view === v} className={chip(view === v)} onClick={() => setView(v)}>{label}</button>
        ))}
      </div>
      {view === 'sessions' && <SportSessions logs={logs} onStart={onStart} />}
      {view === 'progress' && <ProgressView logs={logs} />}
      {view === 'goals' && <SportGoals />}
      {view === 'program' && <ProgramEditor />}
    </div>
  )
}

function SportSessions({ logs, onStart }: { logs: TrainingLog[]; onStart: (s: TrainingSession) => void }) {
  const { data, today } = useStore()
  const [editingWod, setEditingWod] = useState<Wod | null>(null)
  const [creatingWod, setCreatingWod] = useState(false)
  const [detail, setDetail] = useState<TrainingLog | null>(null)
  const sessions = rotation(data.training_sessions)
  const home = rotation(data.training_sessions, 'home')
  const next = nextSession(data.training_sessions, logs)
  const history = [...logs].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, HISTORY_SHOWN)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-start">
        <div className="flex flex-col gap-2">
          {next && <SessionCard session={next} logs={logs} onStart={() => onStart(next)} highlight />}
          {sessions.filter((s) => s.id !== next?.id).map((s) => <SessionCard key={s.id} session={s} logs={logs} onStart={() => onStart(s)} highlight={false} />)}
          {sessions.length === 0 && <p className="text-muted">Aucune séance de salle : crée-la dans « Programme ».</p>}
          {home.length > 0 && <p className="pt-2 text-[12px] font-semibold tracking-wide text-muted uppercase">À la maison</p>}
          {home.map((s) => <SessionCard key={s.id} session={s} logs={logs} onStart={() => onStart(s)} highlight={false} />)}
        </div>
        <div className="flex flex-col gap-3">
          <Regularity logs={logs} today={today} />
          <RecordFeed />
        </div>
      </div>

      <section>
        <SectionTitle>Historique</SectionTitle>
        {history.length === 0 && <p className="border-t border-line py-4 text-muted">Pas encore de séance : lance la prochaine !</p>}
        {history.map((l) => (
          <button key={l.id} type="button" onClick={() => setDetail(l)} className="flex w-full flex-wrap items-center gap-x-3 border-t border-line py-2 text-left">
            <span className="w-16 text-[13px] text-muted">{formatShortDay(l.day)}</span>
            <span className="min-w-40 flex-1 font-medium">{l.name}</span>
            <span className="text-[13px] text-muted tabular-nums">
              {formatDuration(l.duration_s)} · {l.sets.filter((s) => s.done).length} séries · {Math.round(volume(l.sets)).toLocaleString('fr-FR')} kg
              {l.feeling ? ` · ${FEELING_LABELS[l.feeling]}` : ''}
              {l.records.length ? ` · ${l.records.length} record${l.records.length > 1 ? 's' : ''}` : ''}
            </span>
            <span className="text-[13px] font-medium text-accent">+{l.xp_earned} XP</span>
          </button>
        ))}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 pb-2">
          <SectionTitle>Finishers</SectionTitle>
          <Button onClick={() => setCreatingWod(true)}>Nouveau finisher</Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.training_wods.map((w) => (
            <button key={w.id} type="button" onClick={() => setEditingWod(w)} className="card p-3 text-left">
              <p className="font-medium">{w.name}</p>
              <p className="text-[13px] text-muted">
                {WOD_FORMAT_LABELS[w.format]}{w.format === 'tabata' ? ` · ${w.rounds} tours` : ` · ${w.minutes} min`}{w.format === 'for_time' && w.rounds > 1 ? ` · ${w.rounds} tours` : ''}
              </p>
              <p className="text-[13px]">{w.items.join(' · ')}</p>
            </button>
          ))}
        </div>
      </section>
      {detail && <LogDetail log={detail} onClose={() => setDetail(null)} />}
      {(editingWod || creatingWod) && <WodDialog wod={editingWod} onClose={() => { setEditingWod(null); setCreatingWod(false) }} />}
    </div>
  )
}

export function Training() {
  const { data } = useStore()
  const [mobilityDraft, setMobilityDraftState] = useState<MobilityDraft | null>(readMobilityDraft)
  const [discipline, setDiscipline] = useState<Section>(mobilityDraft ? 'mobility' : 'sport')
  const [draft, setDraftState] = useState<Draft | null>(readDraft)
  const [saved, setSaved] = useState<TrainingLog | null>(null)
  const setDraft = (d: Draft | null) => {
    writeDraft(d)
    setDraftState(d)
  }
  const setMobilityDraft = (d: MobilityDraft | null) => {
    writeMobilityDraft(d)
    setMobilityDraftState(d)
  }
  const running = draft ? data.training_sessions.find((s) => s.id === draft.session_id) : undefined
  const runningRoutine = mobilityDraft ? data.training_sessions.find((s) => s.id === mobilityDraft.session_id) : undefined
  const pill = (active: boolean) => `min-h-[38px] rounded-md px-3 text-[13px] font-medium ${active ? 'bg-surface' : ''}`

  if (draft && running) {
    return <SessionRunner session={running} draft={draft} setDraft={setDraft} onClose={(log) => setSaved(log)} />
  }
  if (mobilityDraft && runningRoutine) {
    return <MobilityRunner session={runningRoutine} draft={mobilityDraft} setDraft={setMobilityDraft} onClose={(log) => setSaved(log)} />
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <h1 className="font-display text-[30px] leading-tight">Le donjon</h1>
        <div className="flex seg">
          {SECTIONS.map(([d, label]) => (
            <button key={d} type="button" aria-pressed={discipline === d} className={pill(discipline === d)} onClick={() => setDiscipline(d)}>{label}</button>
          ))}
        </div>
      </div>
      {saved && <div className="pb-5"><Celebration log={saved} onClose={() => setSaved(null)} /></div>}
      {!saved && <div className="pb-4"><WeekStrip onOpen={() => (window.location.hash = '#progress')} /></div>}
      {discipline === 'sport' && (
        <Sport
          onStart={(s) => {
            unlockSound()
            setSaved(null)
            setDraft(startDraft(s, data.training_logs))
          }}
        />
      )}
      {discipline === 'mobility' && (
        <Mobility
          onStart={(routine, level) => {
            unlockSound()
            setSaved(null)
            setMobilityDraft(startMobility(routine, level))
          }}
        />
      )}
      {discipline === 'dance' && <Dance />}
    </>
  )
}
