import { useEffect, useRef, useState } from 'react'
import { useBadges, useTotalXp } from '../data/store'
import { levelFromXp } from '../domain/xp'
import { HeroAvatar, useHero } from './Hero'
import { rankTitle, xpCheer } from './lore'

interface Toast {
  id: number
  text: string
  detail: string
  tone: 'gold' | 'teal'
}

const CONFETTI_COLORS = ['var(--color-gold)', 'var(--color-coral)', 'var(--color-teal)', 'var(--color-pink)', 'var(--color-sky)', 'var(--color-accent)']

/** Paper confetti falling over the level-up panel (pure decoration). */
function Confetti() {
  return (
    <div className="confetti pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2 border border-outline"
          style={{
            left: `${(i * 37) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animation: `confetti-fall ${2.2 + ((i * 13) % 10) / 6}s linear ${((i * 7) % 12) / 10}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Watches the total XP and the badges, and celebrates what changes while the app is open:
 * an XP toast for every gain, a full-screen panel for a new level, a toast for a new badge.
 */
export function Celebration() {
  const totalXp = useTotalXp()
  const badges = useBadges()
  const hero = useHero()
  const unlocked = badges.filter((b) => b.unlocked_on).length
  const previous = useRef({ xp: totalXp, unlocked })
  const [toasts, setToasts] = useState<Toast[]>([])
  const [levelUp, setLevelUp] = useState<number | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = { xp: totalXp, unlocked }
    const gain = totalXp - before.xp
    const added: Toast[] = []
    if (unlocked > before.unlocked) {
      const badge = badges.filter((b) => b.unlocked_on).sort((a, b) => b.unlocked_on!.localeCompare(a.unlocked_on!))[0]
      added.push({ id: Date.now() + 1, text: 'Badge débloqué !', detail: badge?.title ?? '', tone: 'teal' })
    }
    if (gain > 0) {
      added.push({ id: Date.now(), text: `+${gain} XP`, detail: xpCheer(gain), tone: 'gold' })
      const levelBefore = levelFromXp(before.xp).level
      const levelNow = levelFromXp(totalXp).level
      if (levelNow > levelBefore) setLevelUp(levelNow)
    }
    if (added.length > 0) setToasts((list) => [...list, ...added])
    // Only react to the numbers: the badge list is read when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalXp, unlocked])

  useEffect(() => {
    if (levelUp === null) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLevelUp(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [levelUp])

  return (
    <>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[150px] z-20 flex flex-col items-center gap-2 lg:bottom-24">
        {toasts.map((t) => (
          // Each toast removes itself when its animation ends.
          <div key={t.id} onAnimationEnd={() => setToasts((list) => list.filter((x) => x.id !== t.id))} className="anim-toast flex items-center gap-2 rounded-full border-[2.5px] border-outline px-4 py-1.5 text-onsticker shadow-[3px_3px_0_var(--color-outline)]" style={{ background: `var(--color-${t.tone})` }}>
            <span className="font-display text-xl">{t.text}</span>
            {t.detail && <span className="text-[13px] font-extrabold">{t.detail}</span>}
          </div>
        ))}
      </div>

      {levelUp !== null && (
        <div role="dialog" aria-modal="true" aria-label={`Niveau ${levelUp} atteint`} className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 p-5" onClick={() => setLevelUp(null)}>
          <Confetti />
          <div className="card anim-drop relative flex w-full max-w-xs flex-col items-center gap-2 bg-ground p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="sticker" style={{ background: 'var(--color-coral)' }}>Niveau supérieur !</p>
            <HeroAvatar level={levelUp} color={hero.color} size={112} className="anim-bob" />
            <p className="font-display text-4xl">Niveau {levelUp}</p>
            <p className="font-extrabold">{rankTitle(levelUp)} · {hero.heroClass}</p>
            <p className="text-[14px] text-muted">
              {rankTitle(levelUp) !== rankTitle(levelUp - 1)
                ? 'Nouveau rang, nouvel équipement. Le tavernier fait semblant de ne pas être fier.'
                : 'La taverne entière lève sa chope. Enfin, ceux qui sont réveillés.'}
            </p>
            <button type="button" autoFocus className="pressable mt-1 min-h-11 rounded-xl bg-accent px-5 text-sm font-extrabold text-onaccent" onClick={() => setLevelUp(null)}>
              Poursuivre l'aventure
            </button>
          </div>
        </div>
      )}
    </>
  )
}
