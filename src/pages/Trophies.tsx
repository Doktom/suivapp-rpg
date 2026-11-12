import { useMemo, useState, type ReactNode } from 'react'
import { FamilyDot, ProgressBar, SectionTitle, Sticker, XpBar } from '../components/ui'
import { useBadges, useStore, useValidationIndex } from '../data/store'
import { addDays, formatShortDay, mondayOf } from '../domain/date'
import {
  completeMonths,
  completeWeeks,
  completionRate,
  equivalence,
  habitFunStats,
  habitVictories,
  MONTH_THRESHOLD,
  perfectDays,
  runs,
  streakBoard,
  type Victory,
} from '../domain/fun'
import { StatsSection } from './StatsSection'
import { levelFromXp } from '../domain/xp'
import { HeroAvatar, KeeperSays, useHero } from '../rpg/Hero'
import { nextRank, pick } from '../rpg/lore'
import { BADGE_GROUP_LABELS, recordFeed, weekSummary, type BadgeGroup } from '../training/achievements'
import { formatMinutes, STYLE_LABELS } from '../training/dance'
import { volume } from '../training/logic'
import { BadgeCard, Delta, RecordFeed } from '../training/Trophies'

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
const pct = (r: number) => `${Math.round(r * 100)} %`
const GROUPS = Object.keys(BADGE_GROUP_LABELS) as BadgeGroup[]
const VICTORY_DAYS = 14
const VICTORIES_SHOWN = 12
const STREAKS_SHOWN = 6

function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-2 card p-3 ${className}`}>
      {title && <h2 className="font-display text-lg">{title}</h2>}
      {children}
    </section>
  )
}

const STAT_TONES = ['gold', 'teal', 'coral', 'sky', 'pink'] as const

function Stat({ label, display, value, previous, tone }: { label: string; display: string; value: number; previous: number; tone: number }) {
  return (
    <div className="card p-3" style={{ background: `color-mix(in srgb, var(--color-${STAT_TONES[tone % STAT_TONES.length]}) 24%, var(--color-surface))` }}>
      <p className="text-[13px] font-bold text-muted">{label}</p>
      <p className="font-display text-[26px] leading-tight tabular-nums">{display}</p>
      <p className="flex items-center gap-2 text-[12px] text-muted"><Delta current={value} previous={previous} /></p>
    </div>
  )
}

/** The hero's sheet: avatar, level, rank, class and one bar per characteristic. */
function HeroSheet() {
  const hero = useHero()
  const next = nextRank(hero.level)
  return (
    <section aria-label="Fiche du héros" className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b-[2.5px] border-outline bg-accent p-3 text-onaccent">
        <HeroAvatar level={hero.level} color={hero.color} size={96} className="anim-bob" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[26px] leading-tight">Niveau {hero.level}</p>
          <p className="text-[14px] font-extrabold">{hero.rank} · {hero.heroClass}</p>
          <div className="pt-2"><XpBar value={hero.xpInLevel} max={hero.needed} label={`${fmt(hero.xpInLevel)} / ${fmt(hero.needed)} XP`} /></div>
          <p className="pt-1.5 text-[12px] font-bold opacity-90">
            {next ? `Prochain rang : ${next.title} au niveau ${next.level} (avec du nouvel équipement).` : 'Rang maximal. Il ne reste plus qu’à frimer.'}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <h2 className="font-display text-lg">Caractéristiques</h2>
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {hero.stats.map(({ family, xp }) => {
            const stat = levelFromXp(xp)
            return (
              <div key={family.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <FamilyDot color={family.color} />
                  <span className="flex-1 font-extrabold">{family.stat_name}</span>
                  <Sticker tone={hero.favourite?.family.id === family.id ? 'gold' : 'sky'}>niv. {stat.level}</Sticker>
                </div>
                <ProgressBar thin percent={(stat.xpInLevel / stat.needed) * 100} color={family.color} />
              </div>
            )
          })}
        </div>
        {hero.favourite && <p className="text-[13px] text-muted">Caractéristique chouchoute : <strong className="text-ink">{hero.favourite.family.stat_name}</strong> ({fmt(hero.favourite.xp)} XP), d’où ta classe : {hero.heroClass.toLowerCase()}.</p>}
      </div>
    </section>
  )
}

export function Trophies() {
  const { data, today } = useStore()
  const index = useValidationIndex()
  const badges = useBadges()
  const [week, setWeek] = useState<'current' | 'previous'>('current')

  const habits = data.habits
  const perfect = useMemo(() => perfectDays(habits, index, today), [habits, index, today])
  const weeks = useMemo(() => completeWeeks(habits, index, today), [habits, index, today])
  const months = useMemo(() => completeMonths(habits, index, today), [habits, index, today])
  const board = useMemo(() => streakBoard(habits, index, today), [habits, index, today])
  const fun = useMemo(() => habitFunStats(data, index, today), [data, index, today])
  const perfectRuns = runs(perfect, today)

  // The week shown and the one before it, habits and training together.
  const monday = week === 'current' ? mondayOf(today) : addDays(mondayOf(today), -7)
  const before = addDays(monday, -7)
  const habitWeek = (m: string) => {
    const end = addDays(m, 6)
    return {
      rate: completionRate(habits, index, m, end, today),
      perfect: perfect.filter((d) => d >= m && d <= end).length,
      tasks: data.tasks.filter((t) => !t.parent_id && t.completed_at && t.completed_at.slice(0, 10) >= m && t.completed_at.slice(0, 10) <= end).length,
      xp: data.validations.filter((v) => v.day >= m && v.day <= end).reduce((s, v) => s + v.xp_earned, 0),
    }
  }
  const h = habitWeek(monday)
  const hb = habitWeek(before)
  const t = weekSummary(data, monday, badges)
  const tb = weekSummary(data, before, badges)

  // Small victories: habits, records, badges, dance figures, goals.
  const victories: Victory[] = useMemo(() => {
    const from = addDays(today, -VICTORY_DAYS + 1)
    const list: Victory[] = [...habitVictories(habits, index, today, VICTORY_DAYS)]
    for (const r of recordFeed(data.training_logs, data.training_exercises)) {
      if (r.day >= from) list.push({ day: r.day, text: `Record : ${r.exercise.name} à ${fmt(r.value)} ${r.unit} (+${fmt(r.value - r.previous)})` })
    }
    for (const b of badges) if (b.unlocked_on && b.unlocked_on >= from) list.push({ day: b.unlocked_on, text: `Badge débloqué : ${b.title}` })
    for (const f of data.dance_figures) if (f.mastered_on && f.mastered_on >= from) list.push({ day: f.mastered_on, text: `Figure maîtrisée en ${STYLE_LABELS[f.style].toLowerCase()} : ${f.name}` })
    for (const g of [...data.dance_goals, ...data.training_goals]) if (g.achieved_on && g.achieved_on >= from) list.push({ day: g.achieved_on, text: `Objectif atteint : ${g.title}` })
    return list.sort((a, b) => b.day.localeCompare(a.day)).slice(0, VICTORIES_SHOWN)
  }, [habits, index, today, data.training_logs, data.training_exercises, badges, data.dance_figures, data.dance_goals, data.training_goals])

  // Quirky stats.
  const tonnage = data.training_logs.reduce((s, l) => s + volume(l.sets), 0)
  const trainingMinutes = data.training_logs.reduce((s, l) => s + l.duration_s / 60, 0) + data.dance_sessions.filter((d) => d.status === 'done').reduce((s, d) => s + d.duration_min, 0)
  const totalMinutes = fun.minutesInvested + trainingMinutes
  type Quirk = { label: string; value: string; note?: string }
  const quirky = ([

    fun.chronotype ? { label: 'Ton profil', value: `Plutôt ${fun.chronotype}`, note: 'D’après le moment où tu valides tes quêtes.' } : null,
    fun.busiestWeekday ? { label: 'Ton jour fort', value: `Le ${fun.busiestWeekday}`, note: 'Le jour où tu tapes le plus fort.' } : null,
    fun.bestDay ? { label: 'Journée record', value: `${fun.bestDay.count} quêtes`, note: `le ${formatShortDay(fun.bestDay.day)}` } : null,
    { label: 'Quêtes cochées', value: fmt(fun.totalValidations), note: fun.tasksDone ? `et ${fmt(fun.tasksDone)} missions bouclées` : undefined },
    totalMinutes >= 30 ? { label: 'Temps investi', value: formatMinutes(Math.round(totalMinutes)), note: [equivalence(totalMinutes, 'min') && `soit ${equivalence(totalMinutes, 'min')}`, 'habitudes chronométrées, entraînement et danse'].filter(Boolean).join(' · ') } : null,
    tonnage >= 70 ? { label: 'Tonnage soulevé', value: `${fmt(Math.round(tonnage))} kg`, note: equivalence(tonnage, 'kg') ? `soit ${equivalence(tonnage, 'kg')}` : undefined } : null,
    fun.avoidDaysHeld ? { label: 'Jours de résistance', value: fmt(fun.avoidDaysHeld), note: 'tenus face aux tentations' } : null,
    fun.faithful ? { label: 'La plus fidèle', value: fun.faithful.habit.name, note: `${pct(fun.faithful.rate)} sur 30 jours` } : null,
    fun.shy && fun.shy.rate < 0.7 ? { label: 'La plus boudée', value: fun.shy.habit.name, note: `${pct(fun.shy.rate)} sur 30 jours : on lui redonne sa chance ?` } : null,
  ] as (Quirk | null)[]).filter((x): x is Quirk => x !== null)

  const unlocked = badges.filter((b) => b.unlocked_on).length
  const keeperLine =
    unlocked === 0
      ? 'Vitrine vide pour l’instant. Le tavernier a déjà sorti le chiffon à poussière.'
      : pick(
          [
            `${unlocked} ${unlocked > 1 ? 'badges' : 'badge'} en vitrine. Ne touche pas, je viens de faire les vitres.`,
            `Joli butin. Encore ${badges.length - unlocked} à décrocher et je te fais une ristourne.`,
            'Tout ça, c’est à toi. Si, si. Même la poussière.',
          ],
          `${today}-${unlocked}`,
        )

  const pill = (active: boolean) => `min-h-[38px] rounded-md px-3 text-[13px] font-medium ${active ? 'bg-surface' : ''}`

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-[30px] leading-tight">Le butin</h1>
      <HeroSheet />
      <KeeperSays>{keeperLine}</KeeperSays>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Rapport de campagne</SectionTitle>
          <div className="flex seg">
            <button type="button" aria-pressed={week === 'current'} className={pill(week === 'current')} onClick={() => setWeek('current')}>Cette semaine</button>
            <button type="button" aria-pressed={week === 'previous'} className={pill(week === 'previous')} onClick={() => setWeek('previous')}>Semaine dernière</button>
          </div>
        </div>
        <p className="text-[13px] text-muted">Du {formatShortDay(monday)} au {formatShortDay(addDays(monday, 6))}, comparé à la semaine d'avant.</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat tone={0} label="Quêtes tenues" display={h.rate.due ? pct(h.rate.rate) : '—'} value={Math.round(h.rate.rate * 100)} previous={Math.round(hb.rate.rate * 100)} />
          <Stat tone={1} label="Journées parfaites" display={String(h.perfect)} value={h.perfect} previous={hb.perfect} />
          <Stat tone={2} label="Donjons nettoyés" display={String(t.sportSessions)} value={t.sportSessions} previous={tb.sportSessions} />
          <Stat tone={3} label="Fonte soulevée (kg)" display={fmt(t.volume)} value={t.volume} previous={tb.volume} />
          <Stat tone={4} label="Routines de mobilité" display={String(t.mobilityRoutines)} value={t.mobilityRoutines} previous={tb.mobilityRoutines} />
          <Stat tone={0} label="Danse" display={formatMinutes(t.danceMinutes)} value={t.danceMinutes} previous={tb.danceMinutes} />
          <Stat tone={1} label="Missions bouclées" display={String(h.tasks)} value={h.tasks} previous={hb.tasks} />
          <Stat tone={2} label="XP empochée" display={fmt(h.xp + t.xp)} value={h.xp + t.xp} previous={hb.xp + tb.xp} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        <Card title="Hauts faits récents">
          {victories.length === 0 && <p className="text-[13px] text-muted">Tes exploits s’afficheront ici : journées parfaites, séries, records, badges… Les bardes attendent.</p>}
          {victories.map((v, i) => (
            <div key={i} className="flex items-baseline gap-2 border-t border-line pt-1.5 first-of-type:border-t-0">
              <span aria-hidden="true">⭐</span>
              <span className="min-w-0 flex-1 text-sm">{v.text}</span>
              <span className="text-[12px] text-muted">{formatShortDay(v.day)}</span>
            </div>
          ))}
        </Card>

        <Card title="Constance du héros">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border-2 border-outline bg-gold p-2 text-onsticker">
              <p className="font-display text-2xl tabular-nums">{perfect.length}</p>
              <p className="text-[12px] font-bold">journées parfaites</p>
            </div>
            <div className="rounded-xl border-2 border-outline bg-teal p-2 text-onsticker">
              <p className="font-display text-2xl tabular-nums">{weeks.length}</p>
              <p className="text-[12px] font-bold">semaines complètes</p>
            </div>
            <div className="rounded-xl border-2 border-outline bg-pink p-2 text-onsticker">
              <p className="font-display text-2xl tabular-nums">{months.length}</p>
              <p className="text-[12px] font-bold">mois complets</p>
            </div>
          </div>
          <p className="text-[13px] text-muted">
            Journées parfaites d'affilée : <strong className="text-ink">{perfectRuns.current}</strong> en cours, record <strong className="text-ink">{perfectRuns.longest}</strong>.
            {' '}Une semaine est complète si chaque quête n'a qu'un oubli au plus et que les quotas sont tenus ; un mois, s'il dépasse {pct(MONTH_THRESHOLD)}.
          </p>
          <h3 className="pt-1 text-[12px] font-semibold tracking-wide text-muted uppercase">Séries en cours</h3>
          {board.filter((b) => b.best > 0).slice(0, STREAKS_SHOWN).map((b) => (
            <div key={b.habit.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{b.habit.name}</span>
              <span className="w-24"><ProgressBar thin percent={b.best ? (b.current / b.best) * 100 : 0} color="var(--color-coral)" /></span>
              <span className="w-28 text-right text-[12px] text-muted tabular-nums">
                <strong className="text-ink">🔥 {b.current} j</strong> · record {b.best} j
              </span>
            </div>
          ))}
          {board.every((b) => b.best === 0) && <p className="text-[13px] text-muted">Les séries de tes quêtes s’afficheront ici.</p>}
        </Card>
      </div>

      <StatsSection />

      <section className="flex flex-col gap-3">
        <SectionTitle>Potins de la taverne</SectionTitle>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {quirky.map((q) => (
            <div key={q.label} className="card p-3">
              <p className="text-[12px] font-extrabold tracking-wide text-muted uppercase">{q.label}</p>
              <p className="font-display text-xl leading-tight">{q.value}</p>
              {q.note && <p className="text-[12px] text-muted">{q.note}</p>}
            </div>
          ))}
        </div>
      </section>

      <RecordFeed limit={8} />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <SectionTitle>Vitrine des badges</SectionTitle>
          <Sticker>{unlocked} / {badges.length}</Sticker>
        </div>
        {GROUPS.map((g) => (
          <div key={g} className="flex flex-col gap-2">
            <h3 className="text-[12px] font-semibold tracking-wide text-muted uppercase">{BADGE_GROUP_LABELS[g]}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {badges
                .filter((b) => b.group === g)
                .sort((a, b) => Number(!!b.unlocked_on) - Number(!!a.unlocked_on))
                .map((b) => <BadgeCard key={b.id} badge={b} />)}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
