/** The gym program provided by the user (cahier des charges 3.11), and a starter library of finishers. */
import type { Chained, CircuitItem, Exercise, ExerciseItem, Measure, SetTarget, TrainingSession, Wod } from './types'

const id = () => crypto.randomUUID()

/** "2x15/3x10" style prescriptions: [count, reps, note?] groups. Sets of 10 are done with a tempo. */
const sets = (...groups: [number, number, string?][]): SetTarget[] =>
  groups.flatMap(([count, reps, note]) => Array.from({ length: count }, () => ({ reps, note: note ?? '', tempo: reps === 10 })))

export function buildProgram() {
  const exercises: Exercise[] = []
  const ex = (name: string, muscle: string, options: { measure?: Measure; unilateral?: boolean; notes?: string } = {}) => {
    const e: Exercise = { id: id(), name, muscle, measure: options.measure ?? 'reps_weight', unilateral: options.unilateral ?? false, notes: options.notes ?? '' }
    exercises.push(e)
    return e.id
  }
  const item = (exercise_id: string, s: SetTarget[], then: Chained | null = null, note = ''): ExerciseItem => ({
    id: id(),
    kind: 'exercise',
    exercise_id,
    sets: s,
    rest_s: 90,
    then,
    note,
  })

  const butterfly = ex('Écarté butterfly', 'Pecs')
  const convergentSeated = ex('Convergent pec assis', 'Pecs')
  const convergentIncline = ex('Convergent incliné', 'Pecs')
  const militaryPress = ex('Développé militaire machine', 'Épaules')
  const lateralRaise = ex('Élévation latérale haltère', 'Épaules')
  const reverseFly = ex('Reverse fly', 'Épaules')
  const uprightRow = ex('Tirage menton barre', 'Épaules')

  const adductor = ex('Adducteur machine', 'Jambes')
  const abductor = ex('Abducteur machine', 'Jambes')
  const legPress = ex('Presse à cuisse', 'Jambes')
  const bulgarian = ex('Fentes bulgares', 'Jambes', { unilateral: true })
  const hipThrust = ex('Hip thrust', 'Fessiers')
  const legCurl = ex('Leg curl allongé', 'Jambes')
  const legExtension = ex('Leg extension', 'Jambes')

  const ropeExtension = ex('Extension corde poulie haute', 'Triceps')
  const barExtension = ex('Extension barre pronation poulie haute', 'Triceps')
  const machineCurl = ex('Curl machine unilatéral', 'Biceps', { unilateral: true })
  const ropeCurl = ex('Curl corde poulie basse', 'Biceps')
  const latPulldown = ex('Tirage vertical machine', 'Dos')
  const seatedRow = ex('Tirage horizontal poulie prise serrée', 'Dos')
  const lowerBack = ex('Lombaires machine', 'Dos')

  const circuit: CircuitItem = {
    id: id(),
    kind: 'circuit',
    name: 'Circuit abdos-gainage',
    rounds_min: 3,
    rounds_max: 4,
    content: 'Crunchs, gainage, gainage latéral, relevés de jambes',
  }

  const common = { discipline: 'sport' as const, place: 'gym' as const, finisher: true, archived: false, category: '' as const, levels: [] }
  const sessions: TrainingSession[] = [
    {
      ...common,
      id: id(),
      name: 'Training 1 : Pecs / Épaules',
      position: 0,
      warmup: 'Échauffement articulaire',
      items: [
        item(butterfly, sets([3, 15])),
        item(convergentSeated, sets([2, 15], [3, 10])),
        item(convergentIncline, sets([2, 15], [3, 10])),
        item(militaryPress, sets([2, 15], [3, 10])),
        item(lateralRaise, sets([4, 15])),
        item(reverseFly, sets([4, 15])),
        item(uprightRow, sets([3, 15])),
      ],
    },
    {
      ...common,
      id: id(),
      name: 'Training 2 : Jambes',
      position: 1,
      warmup: 'Rameur ou escalier, 10 min',
      items: [
        item(adductor, sets([3, 15]), { exercise_id: abductor, reps: 15, on: 'each' }, '15 adducteurs puis 15 abducteurs enchaînés'),
        item(legPress, sets([2, 25, 'à vide'], [2, 20], [2, 15], [3, 10]), { exercise_id: bulgarian, reps: 10, on: 'last' }, 'Pyramidal ; 10 fentes bulgares par jambe sur la dernière série'),
        item(hipThrust, sets([2, 15], [3, 10])),
        item(legCurl, sets([3, 15])),
        item(legExtension, sets([3, 15])),
        circuit,
      ],
    },
    {
      ...common,
      id: id(),
      name: 'Training 3 : Bras / Dos',
      position: 2,
      warmup: 'Échauffement articulaire',
      items: [
        item(ropeExtension, sets([4, 15])),
        item(barExtension, sets([3, 10])),
        item(machineCurl, sets([4, 15]), null, '15 par bras'),
        item(ropeCurl, sets([3, 10])),
        item(latPulldown, sets([2, 15], [3, 10])),
        item(seatedRow, sets([2, 15], [3, 10])),
        item(lowerBack, sets([4, 15])),
      ],
    },
  ]

  const wod = (name: string, format: Wod['format'], minutes: number, rounds: number, items: string[]): Wod => ({ id: id(), name, format, minutes, rounds, items, builtin: true })
  const wods: Wod[] = [
    wod('Brûle-graisse', 'amrap', 8, 0, ['5 burpees', '10 squats sautés', '15 mountain climbers par jambe']),
    wod('Pompes & fentes', 'emom', 10, 0, ['Minutes paires : 12 pompes', 'Minutes impaires : 20 fentes alternées']),
    wod('Escalier descendant', 'for_time', 12, 1, ['50 squats', '40 crunchs', '30 pompes', '20 burpees', '10 sauts groupés']),
    wod('Tabata burpees', 'tabata', 4, 8, ['Burpees : 20 s d’effort, 10 s de repos']),
    wod('Express', 'amrap', 6, 0, ['10 jumping jacks', '8 pompes', '6 squats sautés']),
    wod('Trois tours', 'for_time', 10, 3, ['15 squats', '10 pompes', '20 crunchs', '30 s de gainage']),
    wod('Cardio minute', 'emom', 8, 0, ['8 burpees chaque minute']),
    wod('Tabata gainage', 'tabata', 4, 8, ['Alterner mountain climbers et gainage : 20 s / 10 s']),
  ]

  return { exercises, sessions, wods }
}
