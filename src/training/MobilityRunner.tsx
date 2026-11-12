import { useEffect, useRef, useState } from 'react'
import { Button, CheckButton, ProgressBar } from '../components/ui'
import { useStore } from '../data/store'
import { beep, useTick, useWakeLock } from './chrono'
import { clock, formatDuration } from './logic'
import { mobilitySteps, mobilityXp, PREP_S, stepsToSets, type MobilityStep } from './mobility'
import type { TrainingLog, TrainingSession } from './types'

/** A mobility routine in progress, kept in this browser. */
export interface MobilityDraft {
  session_id: string
  level: number | null
  started_at: string
  mode: 'guided' | 'check'
  step: number
  /** prep: getting in position; hold: timed; reps: waiting for "Fait"; paused; done: all steps passed. */
  phase: 'prep' | 'hold' | 'reps' | 'paused' | 'done'
  phase_end: number | null
  /** While paused: the phase that was running and its time left (ms). */
  paused: { phase: 'prep' | 'hold'; left: number } | null
  done: boolean[]
}

const KEY = 'suivapp-rpg:mobility-draft'

export function readMobilityDraft(): MobilityDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as MobilityDraft) : null
  } catch {
    return null
  }
}

export function writeMobilityDraft(d: MobilityDraft | null) {
  try {
    if (d) localStorage.setItem(KEY, JSON.stringify(d))
    else localStorage.removeItem(KEY)
  } catch {
    // Private browsing: kept in memory only.
  }
}

/** The phase a step starts with: preparation before a timed hold, or waiting for reps. */
function enter(step: MobilityStep | undefined, now: number): Pick<MobilityDraft, 'phase' | 'phase_end' | 'paused'> {
  if (!step) return { phase: 'done', phase_end: null, paused: null }
  return step.hold_s > 0 ? { phase: 'prep', phase_end: now + PREP_S * 1000, paused: null } : { phase: 'reps', phase_end: null, paused: null }
}

export function startMobility(session: TrainingSession, level: number | null): MobilityDraft {
  const steps = mobilitySteps(session, level)
  return { session_id: session.id, level, started_at: new Date().toISOString(), mode: 'guided', step: 0, ...enter(steps[0], Date.now()), done: steps.map(() => false) }
}

const SIDE_LABELS = { left: 'Côté gauche', right: 'Côté droit' } as const

export function MobilityRunner({ session, draft, setDraft, onClose }: {
  session: TrainingSession
  draft: MobilityDraft
  setDraft: (d: MobilityDraft | null) => void
  onClose: (log: TrainingLog | null) => void
}) {
  const { data, save, today } = useStore()
  const now = useTick(true, 200)
  useWakeLock(true)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const steps = mobilitySteps(session, draft.level)
  const step = steps[draft.step]
  const exercise = (id: string) => data.training_exercises.find((e) => e.id === id)
  const update = (patch: Partial<MobilityDraft>) => setDraft({ ...draft, ...patch })
  const goTo = (index: number, done = draft.done) => update({ step: index, done, ...enter(steps[index], Date.now()) })
  const complete = () => {
    const done = draft.done.map((d, i) => (i === draft.step ? true : d))
    goTo(draft.step + 1, done)
  }

  // Timed phases: beeps on the last 3 seconds, a long beep when the phase changes, then moves on by itself.
  const left = draft.phase_end ? (draft.phase_end - now) / 1000 : null
  const lastSecond = useRef<number | null>(null)
  useEffect(() => {
    if (left === null || draft.mode !== 'guided') return
    const second = Math.ceil(left)
    if (second !== lastSecond.current && second > 0 && second <= 3) beep()
    lastSecond.current = second
    if (left > 0) return
    beep(true)
    if (draft.phase === 'prep') update({ phase: 'hold', phase_end: Date.now() + step.hold_s * 1000 })
    else if (draft.phase === 'hold') complete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left === null ? null : Math.ceil(left), draft.phase, draft.mode])

  const pause = () => {
    if ((draft.phase === 'prep' || draft.phase === 'hold') && draft.phase_end) update({ phase: 'paused', paused: { phase: draft.phase, left: draft.phase_end - Date.now() }, phase_end: null })
  }
  const resume = () => draft.paused && update({ phase: draft.paused.phase, phase_end: Date.now() + draft.paused.left, paused: null })

  const elapsed = (now - Date.parse(draft.started_at)) / 1000
  const doneCount = draft.done.filter(Boolean).length
  const levelName = draft.level !== null ? session.levels[draft.level]?.name : null

  const finish = () => {
    const family = data.families.find((f) => f.name === 'Souplesse') ?? data.families.find((f) => f.stat_name === 'Souplesse')
    const log: TrainingLog = {
      id: crypto.randomUUID(),
      session_id: session.id,
      discipline: 'mobility',
      name: levelName ? `${session.name} · ${levelName}` : session.name,
      day: today,
      started_at: draft.started_at,
      duration_s: Math.round(elapsed),
      feeling: null,
      note: '',
      warmup_done: false,
      circuits: {},
      sets: stepsToSets(steps, draft.done),
      wod_id: null,
      wod_result: '',
      records: [],
      family_id: family?.id ?? null,
      xp_earned: mobilityXp(draft.done),
    }
    save('training_logs', log)
    setDraft(null)
    onClose(log)
  }

  const describe = (s: MobilityStep) =>
    [s.hold_s > 0 ? `${s.hold_s} s` : `${s.reps} répétitions`, s.side ? SIDE_LABELS[s.side].toLowerCase() : '', s.round > 0 ? `tour ${s.round + 1}` : ''].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl">{session.name}{levelName ? ` · ${levelName}` : ''}</h1>
          <p className="text-[13px] text-muted tabular-nums">{clock(elapsed)} · {doneCount}/{steps.length} étapes</p>
        </div>
        <div className="flex seg text-[13px] font-medium">
          {(['guided', 'check'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={draft.mode === m} className={`min-h-[38px] rounded-md px-3 ${draft.mode === m ? 'bg-surface' : ''}`} onClick={() => update(m === 'check' ? { mode: 'check', phase: 'paused', phase_end: null, paused: null } : { mode: 'guided', ...enter(steps[draft.step], Date.now()) })}>
              {m === 'guided' ? 'Guidé' : 'Coche'}
            </button>
          ))}
        </div>
      </div>
      <ProgressBar percent={(doneCount / Math.max(1, steps.length)) * 100} />

      {draft.mode === 'guided' && step && (
        <section className="flex flex-col items-center gap-3 card p-5 text-center" aria-live="polite">
          <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">
            Étape {draft.step + 1} / {steps.length}{step.side ? ` · ${SIDE_LABELS[step.side]}` : ''}{step.round > 0 ? ` · tour ${step.round + 1}` : ''}
          </p>
          <p className="font-display text-2xl">{exercise(step.exercise_id)?.name}</p>
          {exercise(step.exercise_id)?.notes && <p className="max-w-md text-sm text-muted">{exercise(step.exercise_id)?.notes}</p>}
          {draft.phase === 'reps' ? (
            <p className="font-display text-5xl font-semibold tabular-nums">{step.reps} <span className="text-xl">reps</span></p>
          ) : (
            <>
              <p className={`text-sm font-semibold ${draft.phase === 'prep' || draft.paused?.phase === 'prep' ? 'text-warn' : 'text-accent'}`}>
                {draft.phase === 'paused' ? 'En pause' : draft.phase === 'prep' ? 'En position…' : 'Tiens la posture'}
              </p>
              <p className="font-display text-6xl font-semibold tabular-nums">{clock(draft.phase === 'paused' ? (draft.paused?.left ?? 0) / 1000 : (left ?? step.hold_s))}</p>
            </>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button aria-label="Étape précédente" disabled={draft.step === 0} onClick={() => goTo(draft.step - 1)}>◀</Button>
            {draft.phase === 'paused' ? <Button variant="primary" onClick={resume}>Reprendre</Button> : draft.phase !== 'reps' && <Button onClick={pause}>Pause</Button>}
            <Button variant={draft.phase === 'reps' ? 'primary' : 'ghost'} onClick={complete}>Fait</Button>
            <Button aria-label="Passer l'étape" onClick={() => goTo(draft.step + 1)}>Passer ▶</Button>
          </div>
          {steps[draft.step + 1] && <p className="text-[13px] text-muted">Ensuite : {exercise(steps[draft.step + 1].exercise_id)?.name} ({describe(steps[draft.step + 1])})</p>}
        </section>
      )}

      {(draft.mode === 'check' || draft.phase === 'done') && (
        <section className="card p-3">
          {draft.phase === 'done' && draft.mode === 'guided' && <p className="pb-2 font-display text-lg">Routine terminée !</p>}
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 border-t border-line py-1 first:border-t-0">
              <CheckButton square done={draft.done[i]} label={`${draft.done[i] ? 'Annuler' : 'Valider'} : ${exercise(s.exercise_id)?.name}`} onClick={() => update({ done: draft.done.map((d, j) => (j === i ? !d : d)) })} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{exercise(s.exercise_id)?.name}</p>
                <p className="text-[13px] text-muted">{describe(s)}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={finish} disabled={doneCount === 0}>Terminer · {formatDuration(elapsed)}</Button>
        {!confirmQuit && <Button onClick={() => setConfirmQuit(true)}>Abandonner…</Button>}
        {confirmQuit && (
          <>
            <Button className="!bg-warn !text-onaccent" onClick={() => { setDraft(null); onClose(null) }}>Abandonner sans enregistrer</Button>
            <Button onClick={() => setConfirmQuit(false)}>Continuer</Button>
          </>
        )}
      </div>
    </div>
  )
}
