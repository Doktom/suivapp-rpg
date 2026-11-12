import type { Avoid, Checklist, Family, Frequency, HabitShape, HabitTemplate, Level, Moment, Step, TaskList } from './types'

const id = () => crypto.randomUUID()

const FAMILIES: [string, string, string][] = [
  ['Santé', '#22B573', 'Vitalité'],
  ['Sport', '#FF6B3D', 'Force'],
  ['Danse', '#FF4F9A', 'Grâce'],
  ['Souplesse', '#8B5CF6', 'Souplesse'],
  ['Skincare & soins', '#FFB300', 'Éclat'],
  ['Mental & bien-être', '#14B8C4', 'Sérénité'],
  ['Maison', '#84B82D', 'Ordre'],
  ['Apprentissage & créativité', '#3B82F6', 'Savoir'],
]

const daily: Frequency = { type: 'daily' }
const perWeek = (count: number): Frequency => ({ type: 'per_week', count })

type Template = Omit<HabitShape, 'family_id'> & { family: string }

const base = (family: string, name: string, frequency: Frequency, moments: Moment[]) =>
  ({ family, name, frequency, moments, tracking: 'simple', goal: 1, unit: '', levels: [], steps: [], avoid: null }) satisfies Template

const simple = (family: string, name: string, frequency: Frequency, moment: Moment): Template => base(family, name, frequency, [moment])

const duration = (family: string, name: string, minutes: number, frequency: Frequency): Template => ({
  ...base(family, name, frequency, ['day']),
  tracking: 'duration',
  goal: minutes,
  unit: 'min',
})

const levels = (family: string, name: string, details: string[], frequency: Frequency, moment: Moment): Template => ({
  ...base(family, name, frequency, [moment]),
  tracking: 'levels',
  levels: details.map((detail, i): Level => ({ name: ['Rapide', 'Normal', 'Complet'][i], detail, steps: [] })),
})

/** A routine; `cuts` gives how many of the first steps each level contains (empty: no levels). */
const routine = (family: string, name: string, names: string[], cuts: [number, string][], moment: Moment): Template => {
  const steps: Step[] = names.map((n, i) => ({ id: `s${i + 1}`, name: n }))
  return {
    ...base(family, name, daily, [moment]),
    tracking: 'routine',
    steps,
    levels: cuts.map(([count, detail], i) => ({ name: ['Rapide', 'Normal', 'Complet'][i], detail, steps: steps.slice(0, count).map((s) => s.id) })),
  }
}

const avoid = (family: string, name: string, settings: Partial<Avoid> = {}): Template => ({
  ...base(family, name, daily, ['day']),
  tracking: 'avoid',
  avoid: { before: null, after: null, tolerance: 0, period: 'day', ...settings },
})

const STRETCHES = ['Nuque', 'Épaules', 'Dos (chat-vache)', 'Ischios', 'Hanches', 'Fentes']
const STRETCH_LEVELS: [number, string][] = [[2, '2 min'], [4, '5 min'], [6, '10 min']]

export const TEMPLATES: Template[] = [
  duration('Danse', 'Cours de danse', 60, perWeek(3)),
  levels('Danse', 'Entraînement perso / révision de chorégraphie', ['15 min', '30 min', '45 min'], perWeek(2), 'day'),
  duration('Danse', 'Travail technique (pointes, tours, isolations…)', 15, perWeek(3)),
  routine('Souplesse', 'Routine étirements du matin', STRETCHES, STRETCH_LEVELS, 'morning'),
  routine('Souplesse', 'Routine étirements du soir', STRETCHES, STRETCH_LEVELS, 'evening'),
  duration('Souplesse', 'Séance grand écart / souplesse profonde', 20, perWeek(2)),
  duration('Sport', 'Renforcement musculaire', 30, perWeek(3)),
  levels('Sport', 'Gainage', ['2 min', '4 min', '6 min'], daily, 'day'),
  duration('Sport', 'Cardio (course, vélo, corde)', 30, perWeek(2)),
  levels('Sport', 'Marche', ['courte', 'normale', 'longue'], daily, 'day'),
  routine('Skincare & soins', 'Routine skincare du matin', ['Nettoyant', 'Sérum', 'Crème', 'SPF'], [], 'morning'),
  routine('Skincare & soins', 'Routine skincare du soir', ['Démaquillage', 'Nettoyant', 'Soin', 'Crème'], [], 'evening'),
  simple('Skincare & soins', 'Masque / exfoliation', perWeek(2), 'evening'),
  simple('Skincare & soins', 'Soin des cheveux', perWeek(1), 'evening'),
  simple('Santé', 'Boire de l’eau', daily, 'day'),
  simple('Santé', 'Se coucher avant 23 h', daily, 'evening'),
  simple('Santé', 'Manger des légumes', daily, 'day'),
  avoid('Santé', 'Pas de grignotage'),
  avoid('Santé', 'Pas trop de sucre', { tolerance: 1 }),
  avoid('Santé', 'Ne pas fumer avant 12 h', { before: '12:00' }),
  levels('Mental & bien-être', 'Méditation', ['5 min', '10 min', '20 min'], daily, 'morning'),
  simple('Mental & bien-être', 'Journal / gratitude', daily, 'evening'),
  avoid('Mental & bien-être', 'Pas d’écran après 22 h', { after: '22:00' }),
  simple('Maison', 'Faire son lit', daily, 'morning'),
  simple('Maison', 'Vaisselle / cuisine rangée', daily, 'evening'),
  duration('Maison', '15 min de rangement', 15, daily),
  simple('Maison', 'Lessive', perWeek(2), 'day'),
  levels('Apprentissage & créativité', 'Lecture', ['quelques pages', 'un chapitre', 'une longue session'], daily, 'evening'),
  duration('Apprentissage & créativité', 'Langue étrangère', 15, perWeek(5)),
]

/** Built-in templates of a previous version that the current catalogue replaces. */
const RETIRED = ['Marche', 'Lecture', 'Méditation']

/** Built-in templates to add or refresh so that an existing account gets the current catalogue. */
export function syncCatalog(families: Family[], templates: HabitTemplate[]): HabitTemplate[] {
  const updates: HabitTemplate[] = []
  for (const { family, ...shape } of TEMPLATES) {
    const familyId = families.find((f) => f.name === family)?.id
    const existing = templates.find((t) => t.builtin && t.name === shape.name)
    if (existing && (existing.tracking === shape.tracking || !RETIRED.includes(shape.name))) continue
    if (!existing && !familyId) continue
    updates.push({ ...shape, id: existing?.id ?? id(), family_id: existing?.family_id ?? familyId ?? null, builtin: true })
  }
  return updates
}

export function buildSeed() {
  const families: Family[] = FAMILIES.map(([name, color, stat_name], position) => ({
    id: id(),
    name,
    color,
    stat_name,
    position,
  }))
  const habit_templates = syncCatalog(families, [])
  const task_lists: TaskList[] = [
    { id: id(), name: 'Courses', color: '#22B573' },
    { id: id(), name: 'Admin', color: '#14B8C4' },
    { id: id(), name: 'Maison', color: '#84B82D' },
  ]
  const checklists: Checklist[] = [
    {
      id: id(),
      name: 'Grand ménage',
      items: ['Aspirateur', 'Serpillière', 'Salle de bain', 'Cuisine', 'Changer les draps'],
      list_id: task_lists[2].id,
      recurrence: { mode: 'after', interval: 1, unit: 'week' },
    },
  ]
  return { families, habit_templates, task_lists, checklists }
}
