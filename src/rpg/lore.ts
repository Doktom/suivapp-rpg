/**
 * The RPG staging, as pure functions: hero rank and class, gear, boss of the week, tavern keeper lines.
 * Nothing here changes the rules of the app: it only reads what the domain already computes.
 */
import { addDays, daysBetween } from '../domain/date'
import { dayScore } from '../domain/fun'
import type { ValidationIndex } from '../domain/schedule'
import type { Habit } from '../domain/types'

/** Rank titles, by minimum level. */
export const RANKS: [number, string][] = [
  [1, 'Recrue'],
  [3, 'Apprenti'],
  [5, 'Aventurier'],
  [8, 'Héros local'],
  [12, 'Champion'],
  [17, 'Légende'],
  [25, 'Mythe ambulant'],
]

export function rankTitle(level: number): string {
  return [...RANKS].reverse().find(([min]) => level >= min)?.[1] ?? RANKS[0][1]
}

/** The next rank to reach and its level, or null at the top. */
export function nextRank(level: number): { level: number; title: string } | null {
  const next = RANKS.find(([min]) => min > level)
  return next ? { level: next[0], title: next[1] } : null
}

/** How much gear the avatar wears: 0 (bandana) to 5 (crown and aura). One step per rank, capped. */
export function gearTier(level: number): number {
  return Math.min(5, RANKS.filter(([min]) => level >= min).length - 1)
}

const CLASSES: Record<string, string> = {
  Vitalité: 'Druide vitaminé',
  Force: 'Barbare appliqué',
  Grâce: 'Barde déhanché',
  Souplesse: 'Moine élastique',
  Éclat: 'Enchanteur lustré',
  Sérénité: 'Sage imperturbable',
  Ordre: 'Paladin du rangement',
  Savoir: 'Mage à lunettes',
}

/** The hero's class comes from the favourite characteristic (the one with the most XP). */
export function heroClass(statName: string | null | undefined): string {
  if (!statName) return 'Recrue de la taverne'
  return CLASSES[statName] ?? `Touche-à-tout (${statName})`
}

/** Small stable hash, to pick a line that does not change at every render. */
export function hashText(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

export const pick = <T,>(list: T[], seed: string): T => list[hashText(seed) % list.length]

export interface Boss {
  name: string
  emoji: string
  taunt: string
}

export const BOSSES: Boss[] = [
  { name: 'La Flemme Ancestrale', emoji: '🦥', taunt: '« Tu feras ça demain. Ou jamais, c’est bien aussi. »' },
  { name: 'Le Canapé Vorace', emoji: '🛋️', taunt: '« Assieds-toi cinq minutes… pour toujours. »' },
  { name: 'Dame Procrastination', emoji: '🧙‍♀️', taunt: '« Rien ne presse, mon petit. Rien ne presse. »' },
  { name: 'Le Gobelin du Scroll', emoji: '📱', taunt: '« Encore une petite vidéo et on s’y met. »' },
  { name: 'Le Dragon « Demain »', emoji: '🐉', taunt: '« Aujourd’hui est déjà pris, reviens demain. »' },
  { name: 'L’Ogre du Grignotage', emoji: '🧌', taunt: '« Un biscuit pour la route ? Et la route est longue. »' },
  { name: 'Le Spectre de la Grasse Mat’', emoji: '👻', taunt: '« Le réveil ? Quel réveil ? »' },
  { name: 'Le Troll « Juste Cinq Minutes »', emoji: '🧟', taunt: '« Cinq minutes. Promis. Comme hier. »' },
]

/** One boss per week, in rotation, so two weeks in a row never show the same one. */
export function weeklyBoss(monday: string): Boss {
  const week = Math.floor(daysBetween('2024-01-01', monday) / 7)
  return BOSSES[((week % BOSSES.length) + BOSSES.length) % BOSSES.length]
}

export interface BossFight {
  maxHp: number
  hp: number
  defeated: boolean
}

/**
 * The boss has one hit point per habit due this week (fixed-day habits, Monday to Sunday);
 * each habit done takes one away.
 */
export function bossFight(habits: Habit[], index: ValidationIndex, monday: string): BossFight {
  let maxHp = 0
  let hits = 0
  for (let i = 0; i < 7; i++) {
    // No "today" here: the whole week counts, so the boss's hit points do not move during the week.
    const s = dayScore(habits, index, addDays(monday, i), '')
    maxHp += s.due
    hits += s.done
  }
  return { maxHp, hp: maxHp - hits, defeated: maxHp > 0 && hits >= maxHp }
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one)

/** What the tavern keeper says about today's quests. `seed` keeps the line stable (the day, usually). */
export function tavernLine({ done, total, hour, seed }: { done: number; total: number; hour: number; seed: string }): string {
  const rest = total - done
  const key = `${seed}-${done}-${total}`
  if (total === 0) {
    return pick(
      [
        'Aucune quête au tableau. Même les héros ont droit à une grasse matinée.',
        'Tableau vide. Le tavernier astique ses chopes en t’attendant.',
      ],
      key,
    )
  }
  if (done >= total) {
    return pick(
      [
        'Tableau nettoyé ! Le tavernier t’offre une tournée (imaginaire).',
        'Toutes les quêtes sont bouclées. Les bardes en font déjà une chanson.',
        'Plus rien à faire ici. Tu peux fanfaronner jusqu’à demain.',
      ],
      key,
    )
  }
  if (done === 0) {
    if (hour < 12) {
      return pick(
        [
          'Le tableau des quêtes est plein et ta chope est vide. Au boulot, héros.',
          'Bien dormi ? Les quêtes, elles, n’ont pas fermé l’œil.',
          'Première quête de la journée : choisir la première quête.',
        ],
        key,
      )
    }
    if (hour >= 18) {
      return pick(
        [
          'Le soleil se couche et le tableau est intact. Une petite quête pour la forme ?',
          'Il n’est jamais trop tard pour un exploit de dernière minute.',
        ],
        key,
      )
    }
    return pick(
      [
        'Zéro quête pour l’instant. Le tavernier ne juge pas. Enfin si, un peu.',
        'Les quêtes ne vont pas se faire toutes seules. On a vérifié.',
      ],
      key,
    )
  }
  if (done * 2 >= total) {
    return pick(
      [
        `Plus que ${rest} ${plural(rest, 'quête', 'quêtes')} : le boss de la semaine commence à transpirer.`,
        `Plus de la moitié de faite. ${plural(rest, 'La dernière te regarde', 'Les autres te regardent')} de travers.`,
        `Encore ${rest} et tu pourras raconter ça à toute la taverne.`,
      ],
      key,
    )
  }
  return pick(
    [
      `${done} ${plural(done, 'quête bouclée', 'quêtes bouclées')}. Le tavernier est presque impressionné.`,
      `C’est parti ! Encore ${rest} et on en parle au village.`,
      `${done} de moins. Le boss de la semaine a senti passer le courant d’air.`,
    ],
    key,
  )
}

/** A cheer for the XP toast, picked from the amount so it varies. */
export function xpCheer(amount: number): string {
  if (amount >= 50) return pick(['Jackpot !', 'Butin légendaire !', 'Le village applaudit !'], String(amount))
  if (amount >= 20) return pick(['Joli coup !', 'Ça, c’est du butin !', 'Bien joué, héros !'], String(amount))
  return pick(['Cling !', 'Dans la bourse !', 'Et hop !', 'Bim !'], String(amount))
}
