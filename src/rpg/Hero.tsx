import { useMemo } from 'react'
import { useStore, useTotalXp } from '../data/store'
import type { Family } from '../domain/types'
import { levelFromXp } from '../domain/xp'
import { gearTier, heroClass, rankTitle } from './lore'

const INK = 'var(--color-outline)'

/** The hero's level, characteristics (one per family), class and rank. */
export function useHero() {
  const { data } = useStore()
  const total = levelFromXp(useTotalXp())
  const stats = useMemo(() => {
    const families = [...data.families].sort((a, b) => a.position - b.position)
    const habitFamily = new Map(data.habits.map((h) => [h.id, h.family_id]))
    // Sport goals count for Sport (Force); dance figures and goals for Danse (Grâce).
    const sportFamily = data.families.find((f) => f.name === 'Sport')?.id ?? data.families.find((f) => f.stat_name === 'Force')?.id
    const danceFamily = data.families.find((f) => f.name === 'Danse')?.id ?? data.families.find((f) => f.stat_name === 'Grâce')?.id
    const xpOf = (familyId: string) =>
      data.validations.filter((v) => habitFamily.get(v.habit_id) === familyId).reduce((s, v) => s + v.xp_earned, 0) +
      data.training_logs.filter((l) => l.family_id === familyId).reduce((s, l) => s + l.xp_earned, 0) +
      data.dance_sessions.filter((d) => d.family_id === familyId).reduce((s, d) => s + d.xp_earned, 0) +
      (familyId === sportFamily ? data.training_goals.reduce((s, g) => s + g.xp_earned, 0) : 0) +
      (familyId === danceFamily ? data.dance_figures.reduce((s, f) => s + f.xp_earned, 0) + data.dance_goals.reduce((s, g) => s + g.xp_earned, 0) : 0)
    return families.map((family) => ({ family, xp: xpOf(family.id) }))
  }, [data.families, data.habits, data.validations, data.training_logs, data.dance_sessions, data.training_goals, data.dance_figures, data.dance_goals])

  const top = [...stats].sort((a, b) => b.xp - a.xp)[0]
  const favourite: { family: Family; xp: number } | null = top && top.xp > 0 ? top : null
  return {
    ...total,
    stats,
    favourite,
    rank: rankTitle(total.level),
    heroClass: heroClass(favourite?.family.stat_name),
    color: favourite?.family.color ?? '#6b3fe0',
  }
}

/** The avatar: a cheerful head whose headgear improves with the level; the tunic takes the favourite family's color. */
export function HeroAvatar({ level, color, size = 64, className = '' }: { level: number; color: string; size?: number; className?: string }) {
  const tier = gearTier(level)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`Ton héros, ${rankTitle(level).toLowerCase()}`} className={`flex-none ${className}`}>
      {/* Aura of the highest rank */}
      {tier >= 5 && <circle cx="32" cy="32" r="30" fill="var(--color-gold)" opacity="0.45" />}
      {/* Cape */}
      {tier >= 2 && <path d="M12 62c0-12 6-18 20-18s20 6 20 18z" fill="var(--color-pink)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />}
      {/* Tunic */}
      <path d="M17 63c0-10 5-15 15-15s15 5 15 15z" fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 49v8" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      {/* Head */}
      <circle cx="32" cy="31" r="16" fill="#ffd9a8" stroke={INK} strokeWidth="2.5" />
      <circle cx="22" cy="36" r="3" fill="#ff9f8a" opacity="0.7" />
      <circle cx="42" cy="36" r="3" fill="#ff9f8a" opacity="0.7" />
      <circle cx="26" cy="32" r="2.3" fill="#2b1b3d" />
      <circle cx="38" cy="32" r="2.3" fill="#2b1b3d" />
      <path d="M26 39q6 5 12 0" fill="none" stroke="#2b1b3d" strokeWidth="2.3" strokeLinecap="round" />

      {tier === 0 && (
        <>
          <path d="M16.5 26q15.5-9 31 0l-1 4q-14.5-7-29 0z" fill="var(--color-coral)" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M47 27l7-3-2 7z" fill="var(--color-coral)" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        </>
      )}
      {tier === 1 && (
        <>
          {/* A saucepan worn as a helmet */}
          <path d="M16 27c0-10 7-16 16-16s16 6 16 16z" fill="#c9ced6" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M48 22h10" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <path d="M48 22h10" stroke="#8e96a3" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {(tier === 2 || tier === 3) && (
        <>
          <path d="M15 28c0-11 7-18 17-18s17 7 17 18z" fill="var(--color-gold)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M32 28v8" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <path d="M32 28v8" stroke="var(--color-gold)" strokeWidth="2" strokeLinecap="round" />
          {tier === 3 && <path d="M32 10c-2-8 6-11 12-8-5 1-6 5-5 9z" fill="var(--color-teal)" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />}
        </>
      )}
      {tier >= 4 && (
        <>
          <path d="M17 25l-2-14 9 7 8-11 8 11 9-7-2 14z" fill="var(--color-gold)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <circle cx="32" cy="19" r="2.4" fill="var(--color-coral)" stroke={INK} strokeWidth="1.5" />
        </>
      )}
      {tier >= 5 && (
        <>
          <path d="M8 14l1.5 3.5L13 19l-3.5 1.5L8 24l-1.5-3.5L3 19l3.5-1.5z" fill="#fff" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M56 36l1.2 2.8L60 40l-2.8 1.2L56 44l-1.2-2.8L52 40l2.8-1.2z" fill="#fff" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

/** The tavern keeper's face, next to his speech bubbles. */
export function Keeper({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="flex-none">
      <circle cx="24" cy="25" r="17" fill="#f2b98a" stroke={INK} strokeWidth="2.5" />
      <path d="M9 20c1-10 8-15 15-15s14 5 15 15c-5-4-9-5-15-5s-10 1-15 5z" fill="#8a5a3c" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M17 21l6 2M31 21l-6 2" stroke="#2b1b3d" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="19" cy="26" r="1.9" fill="#2b1b3d" />
      <circle cx="29" cy="26" r="1.9" fill="#2b1b3d" />
      <path d="M12 31c4 1 8 3 12 0 4 3 8 1 12 0-1 9-6 13-12 13s-11-4-12-13z" fill="#8a5a3c" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M20 36q4 2 8 0" fill="none" stroke="#2b1b3d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** The tavern keeper with one line in a speech bubble. */
export function KeeperSays({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <Keeper />
      <p className="bubble min-w-0 flex-1 text-[14px]">{children}</p>
    </div>
  )
}
