/**
 * The dungeon staging (the Entraînement tab), as pure functions: its three wings, the monster behind each
 * exercise, the hit points left during a session, and what the tavern keeper says about the week.
 * Like lore.ts, it changes no rule: it only dresses up what the training module computes.
 */
import type { Discipline, LoggedSet } from '../training/types'
import { pick } from './lore'

export interface Wing {
  name: string
  emoji: string
  /** CSS color of the wing (a theme token). */
  color: string
  stat: string
}

export const WINGS: Record<Discipline, Wing> = {
  sport: { name: 'Salle d’armes', emoji: '⚔️', color: 'var(--color-coral)', stat: 'Force' },
  mobility: { name: 'Temple de souplesse', emoji: '🧘', color: 'var(--color-lilac)', stat: 'Souplesse' },
  dance: { name: 'Salle de bal', emoji: '💃', color: 'var(--color-pink)', stat: 'Grâce' },
}

const MONSTERS = ['👹', '🐗', '🦂', '🐍', '🕷️', '🦇', '🐺', '🐊', '🦖', '🐙', '🧟', '🦍', '🐻', '🦏']
const EPITHETS = ['enragé', 'des cavernes', 'qui pique', 'sournois', 'en fonte', 'du sous-sol', 'grognon', 'aux gros bras']

/** The monster that guards an exercise: always the same for the same exercise. */
export function monsterFor(exerciseId: string): { emoji: string; epithet: string } {
  return { emoji: pick(MONSTERS, exerciseId), epithet: pick(EPITHETS, `${exerciseId}-e`) }
}

/** An exercise's hit points: one per main set (chained movements do not count), one less per set done. */
export function monsterHp(rows: LoggedSet[]): { hp: number; maxHp: number; defeated: boolean } {
  const main = rows.filter((r) => !r.chained)
  const maxHp = main.length
  const hp = main.filter((r) => !r.done).length
  return { hp, maxHp, defeated: maxHp > 0 && hp === 0 }
}

/** How many exercises of a session were finished: each one is a monster defeated. */
export function monstersDefeated(sets: LoggedSet[]): number {
  const byItem = new Map<string, LoggedSet[]>()
  for (const s of sets) byItem.set(s.item_id, [...(byItem.get(s.item_id) ?? []), s])
  return [...byItem.values()].filter((rows) => monsterHp(rows).defeated).length
}

/** What the tavern keeper says at the dungeon gate, from the gym sessions done this week. */
export function dungeonLine({ done, target, next, seed }: { done: number; target: number; next: string | null; seed: string }): string {
  const key = `${seed}-${done}`
  if (done >= target) {
    return pick(
      [
        `${done} expéditions cette semaine. Les monstres ont déposé une plainte.`,
        'Quota de la semaine atteint. Tout le reste, c’est du bonus (et de la frime).',
      ],
      key,
    )
  }
  if (done === 0) {
    return pick(
      [
        next ? `Le donjon s’impatiente. Prochaine porte : « ${next} ».` : 'Le donjon s’impatiente. Choisis une porte.',
        'Pas encore descendu cette semaine. Les monstres prennent leurs aises.',
      ],
      key,
    )
  }
  const rest = target - done
  return pick(
    [
      `${done} expédition${done > 1 ? 's' : ''} sur ${target}. Encore ${rest} et les monstres négocient.`,
      next ? `Bien entamé. Prochaine porte : « ${next} ».` : 'Bien entamé. Continue sur ta lancée.',
    ],
    key,
  )
}
