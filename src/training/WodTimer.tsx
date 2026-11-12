import { useEffect, useRef } from 'react'
import { Button } from '../components/ui'
import { beep } from './chrono'
import { clock } from './logic'
import { WOD_FORMAT_LABELS, type Wod } from './types'

const TABATA_WORK = 20
const TABATA_REST = 10

/** Where a finisher stands at `elapsed` seconds: phase name, seconds left in it, and whether it is over. */
export function wodPhase(wod: Wod, elapsed: number): { label: string; left: number; key: string; over: boolean } {
  if (wod.format === 'tabata') {
    const cycle = TABATA_WORK + TABATA_REST
    const rounds = Math.max(1, wod.rounds)
    if (elapsed >= rounds * cycle) return { label: 'Terminé', left: 0, key: 'end', over: true }
    const round = Math.floor(elapsed / cycle)
    const inCycle = elapsed - round * cycle
    const work = inCycle < TABATA_WORK
    return {
      label: `${work ? 'Effort' : 'Repos'} · tour ${round + 1} / ${rounds}`,
      left: work ? TABATA_WORK - inCycle : cycle - inCycle,
      key: `${round}-${work}`,
      over: false,
    }
  }
  const total = Math.max(1, wod.minutes) * 60
  if (elapsed >= total) return { label: wod.format === 'for_time' ? 'Temps limite atteint' : 'Terminé', left: 0, key: 'end', over: true }
  if (wod.format === 'emom') {
    const minute = Math.floor(elapsed / 60)
    return { label: `Minute ${minute + 1} / ${wod.minutes}`, left: 60 - (elapsed - minute * 60), key: `m${minute}`, over: false }
  }
  if (wod.format === 'for_time') return { label: `Chrono · limite ${wod.minutes} min`, left: total - elapsed, key: 'run', over: false }
  return { label: `AMRAP ${wod.minutes} min : un maximum de tours`, left: total - elapsed, key: 'run', over: false }
}

/** The finisher's chrono: beeps at each phase change and on the last 3 seconds. */
export function WodTimer({ wod, startedAt, now, onStart, onStop }: {
  wod: Wod
  startedAt: number | null
  now: number
  onStart: () => void
  /** Called with the elapsed seconds when the timer ends or is stopped. */
  onStop: (elapsed: number) => void
}) {
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0
  const phase = wodPhase(wod, elapsed)
  const lastKey = useRef<string | null>(null)
  const lastSecond = useRef<number | null>(null)

  useEffect(() => {
    if (!startedAt) return
    if (lastKey.current !== null && lastKey.current !== phase.key) beep(true)
    lastKey.current = phase.key
    const second = Math.ceil(phase.left)
    if (second !== lastSecond.current && [3, 2, 1].includes(second)) beep()
    lastSecond.current = second
    if (phase.over) onStop(Math.round(elapsed))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, phase.key, Math.ceil(phase.left), phase.over])

  const forTime = wod.format === 'for_time'
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-chip p-4 text-center">
      <span className="text-[13px] font-medium text-muted">{WOD_FORMAT_LABELS[wod.format]} · {phase.label}</span>
      <span className="font-display text-5xl font-semibold tabular-nums">{forTime && startedAt ? clock(elapsed) : clock(startedAt ? phase.left : wodPhase(wod, 0).left)}</span>
      {!startedAt && <Button variant="primary" onClick={onStart}>Lancer le chrono</Button>}
      {startedAt && !phase.over && (
        <Button variant="primary" onClick={() => onStop(Math.round(elapsed))}>{forTime ? 'Terminé !' : 'Arrêter'}</Button>
      )}
    </div>
  )
}
