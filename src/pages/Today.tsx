import { useState } from 'react'
import { HabitRow } from '../components/HabitRow'
import { TaskItem } from '../components/TaskItem'
import { Button, ProgressBar, SectionTitle, Sticker, XpBar } from '../components/ui'
import { useStore, useToday, useValidationIndex } from '../data/store'
import { addDays, clockTime, formatLongDay, mondayOf } from '../domain/date'
import { isAvoidOk, isAvoidSettled, isDayDone, isDueOn } from '../domain/schedule'
import { MOMENT_LABELS, MOMENTS, type Moment } from '../domain/types'
import { HeroAvatar, KeeperSays, useHero } from '../rpg/Hero'
import { bossFight, tavernLine, weeklyBoss } from '../rpg/lore'
import { TrainingToday } from '../training/TodayCard'

/** How many past days can be corrected. */
const MAX_CORRECTION_DAYS = 13
const fmt = (n: number) => n.toLocaleString('fr-FR')
const MOMENT_EMOJI: Record<Moment, string> = { morning: '🌅', day: '☀️', evening: '🌙' }

/** The boss of the week: every habit done takes one hit point away. */
function BossCard() {
  const { data } = useStore()
  const today = useToday()
  const index = useValidationIndex()
  const monday = mondayOf(today)
  const boss = weeklyBoss(monday)
  const fight = bossFight(data.habits, index, monday)
  if (fight.maxHp === 0) return null
  return (
    <section aria-label="Boss de la semaine" className="card flex items-center gap-3 p-3" style={{ background: 'color-mix(in srgb, var(--color-coral) 28%, var(--color-surface))' }}>
      <span aria-hidden="true" className={`text-[40px] leading-none ${fight.defeated ? 'grayscale' : 'anim-bob'}`}>{boss.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold tracking-wide text-muted uppercase">Boss de la semaine</p>
        <p className={`font-display text-lg leading-tight ${fight.defeated ? 'line-through' : ''}`}>{boss.name}</p>
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1"><ProgressBar percent={(fight.hp / fight.maxHp) * 100} color="var(--color-coral)" /></div>
          <span className="text-[12px] font-extrabold tabular-nums">{fight.hp} / {fight.maxHp} PV</span>
        </div>
        <p className="pt-1 text-[13px] text-muted">{fight.defeated ? 'Terrassé ! Il reviendra lundi, déguisé en quelqu’un d’autre.' : boss.taunt}</p>
      </div>
    </section>
  )
}

export function Today() {
  const { data, now } = useStore()
  const today = useToday()
  const index = useValidationIndex()
  const hero = useHero()
  const [day, setDay] = useState(today)
  const [groupBy, setGroupBy] = useState<'moment' | 'family'>('moment')

  const due = data.habits.filter((h) => isDueOn(h, index, day)).sort((a, b) => (a.time_of_day ?? '99').localeCompare(b.time_of_day ?? '99'))
  const rows = due.flatMap((habit) => habit.moments.map((moment) => ({ habit, moment })))
  const families = [...data.families].sort((a, b) => a.position - b.position)
  const sections =
    groupBy === 'moment'
      ? MOMENTS.map((m) => ({ key: m as string, label: `${MOMENT_EMOJI[m]} ${MOMENT_LABELS[m]}`, color: undefined as string | undefined, rows: rows.filter((r) => r.moment === m) }))
      : [...families.map((f) => ({ id: f.id as string | null, name: f.name, color: f.color as string | undefined })), { id: null, name: 'Sans famille', color: undefined }].map((f) => ({
          key: f.id ?? 'none',
          label: f.name,
          color: f.color,
          rows: rows.filter((r) => r.habit.family_id === f.id),
        }))
  const tasks = data.tasks.filter((t) => !t.parent_id && t.due_date !== null && t.due_date <= day && (!t.completed_at || t.due_date === day))
  const doneCount = due.filter((h) => isDayDone(h, index, day)).length
  // Avoid habits still running today are neither done nor missed yet: they are counted apart.
  const running = due.filter(
    (h) => h.tracking === 'avoid' && !isDayDone(h, index, day) && isAvoidOk(h, data.slips, day) && !isAvoidSettled(h, day, today, clockTime(now)),
  ).length
  const total = due.length - running

  const pill = (active: boolean) => `min-h-[38px] rounded-md px-3 text-[13px] font-medium ${active ? 'bg-surface' : ''}`

  return (
    <>
      <header className="flex flex-col gap-3 pb-5">
        <div>
          <h1 className="font-display text-[30px] leading-tight">{day === today ? 'Le tableau des quêtes' : 'Retour vers le passé'}</h1>
          <div className="-ml-2 flex items-center text-sm font-bold text-muted">
            <button type="button" aria-label="Jour précédent" disabled={day <= addDays(today, -MAX_CORRECTION_DAYS)} onClick={() => setDay(addDays(day, -1))} className="size-11 text-2xl disabled:opacity-30">‹</button>
            <span>{formatLongDay(day)}</span>
            <button type="button" aria-label="Jour suivant" disabled={day >= today} onClick={() => setDay(addDays(day, 1))} className="size-11 text-2xl disabled:opacity-30">›</button>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-2 lg:gap-4">
          <section aria-label="Ton héros" className="card flex items-center gap-3 bg-accent p-3 text-onaccent">
            <a href="#progress" aria-label="Voir la fiche du héros"><HeroAvatar level={hero.level} color={hero.color} size={72} className="anim-bob" /></a>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl leading-tight">Niveau {hero.level} · {hero.rank}</p>
              <p className="truncate text-[13px] font-extrabold opacity-90">{hero.heroClass}</p>
              <div className="pt-1.5"><XpBar value={hero.xpInLevel} max={hero.needed} label={`${fmt(hero.xpInLevel)} / ${fmt(hero.needed)} XP`} /></div>
              <p className="pt-1.5 text-[13px] font-extrabold">
                {doneCount} sur {total} {total > 1 ? 'quêtes' : 'quête'}
                {running > 0 && <span className="font-bold opacity-90"> · {running} à tenir en cours</span>}
              </p>
            </div>
          </section>
          {day === today && <div className="pt-3 lg:pt-0"><BossCard /></div>}
        </div>

        {day === today && <KeeperSays>{tavernLine({ done: doneCount, total, hour: now.getHours(), seed: today })}</KeeperSays>}
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start lg:gap-10">
        <section>
          <div className="flex items-center justify-between gap-3 pb-3">
            <SectionTitle>Quêtes du jour</SectionTitle>
            <div className="flex seg">
              <button type="button" aria-pressed={groupBy === 'moment'} className={pill(groupBy === 'moment')} onClick={() => setGroupBy('moment')}>Moment</button>
              <button type="button" aria-pressed={groupBy === 'family'} className={pill(groupBy === 'family')} onClick={() => setGroupBy('family')}>Famille</button>
            </div>
          </div>
          {due.length === 0 && (
            <div className="card flex flex-col items-start gap-3 p-4">
              <p className="text-muted">Aucune quête au tableau ce jour-là. Le tavernier s’ennuie.</p>
              <a href="#habits"><Button variant="primary" tabIndex={-1}>Afficher des quêtes</Button></a>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {sections.filter((s) => s.rows.length > 0).map((s) => {
              const done = s.rows.filter((r) => isDayDone(r.habit, index, day)).length
              return (
                <div key={s.key} className="card overflow-hidden">
                  <h3 className="flex items-center justify-between gap-2 border-b-[2.5px] border-outline px-3 py-1.5 font-display text-[17px]" style={{ background: s.color ? `color-mix(in srgb, ${s.color} 38%, var(--color-surface))` : 'var(--color-chip)' }}>
                    {s.label}
                    <Sticker tone={done === s.rows.length ? 'teal' : 'gold'}>{done} / {s.rows.length}</Sticker>
                  </h3>
                  <div className="px-2 [&>*:first-child]:border-t-0">
                    {s.rows.map((r) => (
                      <HabitRow key={`${r.habit.id}-${r.moment}`} habit={r.habit} moment={r.moment} day={day} showMoment={groupBy === 'family'} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="flex flex-col gap-5 pt-5 lg:pt-0">
          {day === today && <TrainingToday />}
          <section>
            <div className="pb-3"><SectionTitle>Missions du jour</SectionTitle></div>
            <div className="card px-2 [&>*:first-child]:border-t-0">
              {tasks.length === 0 && <p className="px-1 py-4 text-muted">Aucune mission pour ce jour. Profites-en, ça ne dure jamais.</p>}
              {tasks.map((t) => <TaskItem key={t.id} task={t} today={today} />)}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
