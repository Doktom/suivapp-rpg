import { useStore, useStreaks, useToday, useValidationIndex } from '../data/store'
import { clockTime, mondayOf } from '../domain/date'
import { describeAvoid } from '../domain/describe'
import {
  getValidation,
  isAvoidOk,
  isAvoidSettled,
  isMomentDone,
  isQuota,
  periodDoneCount,
  quotaCount,
  routineLevels,
  slipsOn,
} from '../domain/schedule'
import { computeStreak, STREAK_UNIT } from '../domain/streak'
import { MOMENT_LABELS, type Habit, type Moment } from '../domain/types'
import { Button, CheckButton, FamilyDot, ProgressBar, Sticker } from './ui'

const fmt = (n: number) => n.toLocaleString('fr-FR')

function stepFor(habit: Habit) {
  if (habit.tracking === 'duration') return 5
  return habit.goal >= 1000 ? 1000 : Math.max(1, Math.round(habit.goal / 5))
}

const chip = (active: boolean) =>
  `min-h-9 rounded-full border-2 border-outline px-3 text-[13px] font-extrabold ${active ? 'bg-teal text-onsticker' : 'bg-surface text-ink'}`

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

function LevelsInput({ habit, value, onChange }: { habit: Habit; value: number; onChange: (level: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1 pb-1.5 pl-[52px]">
      {habit.levels.map((level, i) => (
        <button key={i} type="button" aria-pressed={value === i + 1} className={chip(value === i + 1)} onClick={() => onChange(value === i + 1 ? 0 : i + 1)}>
          {level.name}{level.detail ? ` · ${level.detail}` : ''}
        </button>
      ))}
    </div>
  )
}

function RoutineInput({ habit, done, onChange }: { habit: Habit; done: string[]; onChange: (steps: string[]) => void }) {
  const toggle = (id: string) => onChange(done.includes(id) ? done.filter((s) => s !== id) : [...done, id])
  const levels = routineLevels(habit)
  return (
    <div className="pt-1 pb-1.5 pl-[52px]">
      {habit.levels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-1.5">
          {levels.map((level, i) => {
            const complete = level.steps.length > 0 && level.steps.every((id) => done.includes(id))
            return (
              <button key={i} type="button" aria-pressed={complete} className={chip(complete)} onClick={() => onChange(complete ? done.filter((id) => !level.steps.includes(id)) : [...new Set([...done, ...level.steps])])}>
                {level.name}{level.detail ? ` · ${level.detail}` : ''}
              </button>
            )
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {habit.steps.map((step) => (
          <button key={step.id} type="button" aria-pressed={done.includes(step.id)} onClick={() => toggle(step.id)} className={`min-h-9 rounded-lg border-2 px-2.5 text-[13px] font-bold ${done.includes(step.id) ? 'border-outline bg-teal text-onsticker line-through' : 'border-line bg-surface'}`}>
            {step.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function HabitRow({ habit, moment, day, showMoment }: { habit: Habit; moment: Moment; day: string; showMoment: boolean }) {
  const { data, now, setValidation, setRoutineSteps, toggleMoment, addSlip, removeSlip } = useStore()
  const today = useToday()
  const index = useValidationIndex()
  const validation = getValidation(index, habit.id, day, moment)
  const value = validation?.value ?? 0
  const done = isMomentDone(habit, index, day, moment)
  const family = data.families.find((f) => f.id === habit.family_id)
  const streak = useStreaks().get(habit.id) ?? computeStreak(habit, index, today)
  const step = stepFor(habit)

  const parts: string[] = []
  if (isQuota(habit)) {
    const period = habit.frequency.type === 'per_month' ? 'ce mois' : 'cette semaine'
    parts.push(`${periodDoneCount(habit, index, day)} sur ${quotaCount(habit)} ${period}`)
    if (streak.current > 0) parts.push(`🔥 série ${streak.current} ${STREAK_UNIT[streak.unit]}`)
  } else if (streak.current > 0) {
    parts.push(`🔥 Série ${streak.current} j`)
  }
  if (family) parts.push(family.name)
  if (habit.time_of_day) parts.push(habit.time_of_day)

  const check = () => toggleMoment(habit, day, moment)
  let status: string | null = null
  let missed = false
  if (habit.tracking === 'routine') {
    const levels = routineLevels(habit)
    if (value > 0 && habit.levels.length > 0) status = `Niveau ${levels[value - 1].name}`
  }
  const slipCount = habit.tracking === 'avoid' ? slipsOn(habit, data.slips, day) : 0
  const anySlip = data.slips.some((s) => s.habit_id === habit.id && s.day === day)
  if (habit.tracking === 'avoid') {
    const ok = isAvoidOk(habit, data.slips, day)
    const settled = isAvoidSettled(habit, day, today, clockTime(now))
    if (habit.avoid) {
      const rule = describeAvoid(habit.avoid)
      if (rule) parts.unshift(rule)
    }
    const slipsText = slipCount ? ` · ${plural(slipCount, 'écart')}` : ''
    missed = !ok
    status = !ok ? `Raté, ça arrive aux meilleurs${slipsText}` : done || settled ? `Tenu bon${slipsText}` : `Tu résistes${slipsText}`
  }

  return (
    <div className="border-t border-line py-1.5">
      <div className="flex items-center gap-2">
        <CheckButton done={done} label={`${done ? 'Annuler' : 'Valider'} : ${habit.name}`} onClick={check} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-extrabold">
            <FamilyDot color={family?.color} />
            <span>{habit.name}{showMoment && habit.moments.length > 1 ? ` (${MOMENT_LABELS[moment].toLowerCase()})` : ''}</span>
          </div>
          <div className="text-[13px] text-muted">{parts.join(' · ')}</div>
          {status && <div className={`text-[13px] ${missed ? 'text-warn' : 'text-accent'}`}>{status}</div>}
          {streak.graceWeeks.has(mondayOf(today)) && !isQuota(habit) && <div className="text-[13px] text-warn">Jour de grâce utilisé cette semaine</div>}
        </div>
        {validation && validation.xp_earned > 0 && <Sticker className="anim-pop flex-none">+{validation.xp_earned} XP</Sticker>}
      </div>
      {(habit.tracking === 'duration' || habit.tracking === 'quantity') && (
        <div className="flex items-center gap-1 pl-[52px]">
          <div className="flex-1"><ProgressBar thin percent={(value / habit.goal) * 100} color={family?.color} /></div>
          <span className="min-w-24 text-right text-[13px] text-muted tabular-nums">{fmt(value)} / {fmt(habit.goal)} {habit.unit}</span>
          <button type="button" aria-label={`Diminuer ${habit.name}`} className="size-11 text-xl" onClick={() => setValidation(habit, day, moment, Math.max(0, value - step))}>−</button>
          <button type="button" aria-label={`Augmenter ${habit.name}`} className="size-11 text-xl" onClick={() => setValidation(habit, day, moment, Math.min(habit.goal, value + step))}>+</button>
        </div>
      )}
      {habit.tracking === 'levels' && <LevelsInput habit={habit} value={value} onChange={(level) => setValidation(habit, day, moment, level)} />}
      {habit.tracking === 'routine' && <RoutineInput habit={habit} done={validation?.steps ?? []} onChange={(steps) => setRoutineSteps(habit, day, moment, steps)} />}
      {habit.tracking === 'avoid' && (
        <div className="flex flex-wrap gap-1.5 pt-1 pb-1.5 pl-[52px]">
          <Button className="!min-h-9 text-[13px]" onClick={() => addSlip(habit, day)}>Noter un écart</Button>
          {anySlip && <Button className="!min-h-9 text-[13px]" onClick={() => removeSlip(habit, day)}>Retirer un écart</Button>}
        </div>
      )}
    </div>
  )
}

