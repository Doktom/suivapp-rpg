import { useEffect, type ReactNode } from 'react'
import { isDemo } from '../data/repo'
import { useUndo } from '../data/store'
import { Celebration } from '../rpg/Celebration'
import { HeroAvatar, useHero } from '../rpg/Hero'

export type Route = 'today' | 'habits' | 'training' | 'tasks' | 'agenda' | 'progress' | 'settings'

/** Each screen has its RPG name and its emblem. */
const NAV: [Route, string, string][] = [
  ['today', 'Taverne', '🍺'],
  ['habits', 'Quêtes', '📜'],
  ['training', 'Donjon', '⚔️'],
  ['tasks', 'Missions', '🎯'],
  ['agenda', 'Agenda', '🗺️'],
  ['progress', 'Butin', '🏆'],
  ['settings', 'Réglages', '⚙️'],
]

/** How long the "Annuler" banner stays. */
const UNDO_MS = 6000

function UndoBanner() {
  const { entry, undo, dismiss } = useUndo()
  useEffect(() => {
    if (!entry) return
    const timer = setTimeout(dismiss, UNDO_MS)
    return () => clearTimeout(timer)
    // Restart the timer for each new action only, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.at])
  if (!entry) return null
  return (
    <div role="status" className="fixed inset-x-3 bottom-[88px] z-10 mx-auto flex max-w-md items-center gap-3 rounded-2xl border-[2.5px] border-outline bg-ink py-1 pr-1 pl-4 text-sm text-ground shadow-[3px_3px_0_var(--color-outline)] lg:bottom-6">
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      <button type="button" className="min-h-11 rounded-xl bg-gold px-3 font-extrabold text-onsticker" onClick={undo}>Annuler</button>
    </div>
  )
}

/** On phones, the settings live at the top instead of in the bottom bar. */
const MORE: Route[] = ['settings']

/** The hero in a corner of the screen: avatar, level and rank. Opens the Butin screen. */
function HeroBadge() {
  const hero = useHero()
  return (
    <a href="#progress" aria-label={`Niveau ${hero.level}, ${hero.rank} : voir le butin`} className="flex min-h-11 min-w-0 items-center gap-2">
      <HeroAvatar level={hero.level} color={hero.color} size={40} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-[17px]">Suivapp RPG</span>
        <span className="block truncate text-[12px] font-extrabold text-muted">Niv. {hero.level} · {hero.rank}</span>
      </span>
    </a>
  )
}

export function Layout({ route, error, children }: { route: Route; error: string | null; children: ReactNode }) {
  return (
    <div className="lg:flex lg:min-h-dvh">
      <nav aria-label="Navigation principale" className="hidden w-60 flex-none flex-col gap-1.5 border-r-[2.5px] border-outline bg-surface p-4 lg:flex">
        <div className="mb-4"><HeroBadge /></div>
        {NAV.map(([r, label, emoji]) => (
          <a
            key={r}
            href={`#${r}`}
            aria-current={r === route ? 'page' : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl border-[2.5px] px-3 text-sm font-extrabold ${r === route ? 'border-outline bg-gold text-onsticker shadow-[3px_3px_0_var(--color-outline)]' : 'border-transparent text-muted'}`}
          >
            <span aria-hidden="true" className="text-xl">{emoji}</span>
            {label}
          </a>
        ))}
      </nav>

      <div className="min-w-0 flex-1 pb-28 lg:pb-8">
        {isDemo && <p className="border-b-2 border-outline bg-chip px-5 py-2 text-center text-xs text-ink">Version de test : les données restent dans ce navigateur (Réglages → Exporter mes données pour les sauvegarder).</p>}
        {error && <p role="alert" className="bg-warn px-5 py-2 text-center text-sm text-onaccent">{error}</p>}
        <div className="flex items-center justify-between gap-2 px-4 pt-2 lg:hidden">
          <HeroBadge />
          {NAV.filter(([r]) => MORE.includes(r)).map(([r, label, emoji]) => (
            <a key={r} href={`#${r}`} aria-label={label} aria-current={r === route ? 'page' : undefined} className={`flex size-11 flex-none items-center justify-center rounded-xl border-[2.5px] text-xl ${r === route ? 'border-outline bg-gold' : 'border-transparent'}`}>
              <span aria-hidden="true">{emoji}</span>
            </a>
          ))}
        </div>
        <main className="mx-auto max-w-5xl px-4 pt-3 lg:px-10 lg:pt-10">{children}</main>
      </div>

      <UndoBanner />
      <Celebration />

      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t-[2.5px] border-outline bg-[#2b1b3d] px-1 pt-1.5 pb-2.5 lg:hidden">
        {NAV.filter(([r]) => !MORE.includes(r)).map(([r, label, emoji]) => (
          <a
            key={r}
            href={`#${r}`}
            aria-current={r === route ? 'page' : undefined}
            className={`flex min-h-13 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-extrabold tracking-tight whitespace-nowrap ${r === route ? 'bg-gold text-onsticker' : 'text-[#e3d8f7]'}`}
          >
            <span aria-hidden="true" className={`text-[20px] leading-none ${r === route ? 'anim-wiggle' : ''}`}>{emoji}</span>
            {label}
          </a>
        ))}
      </nav>
    </div>
  )
}
