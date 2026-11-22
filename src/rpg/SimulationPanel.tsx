import { useState } from 'react'
import { Button, ChipTabs, SectionTitle, Sticker } from '../components/ui'
import { isDemo } from '../data/repo'
import { enterSandbox, isSandbox, leaveSandbox, setSimOffsetDays, simOffsetDays } from '../data/sandbox'
import { useStore } from '../data/store'
import { addDays, formatLongDay } from '../domain/date'
import { KeeperSays } from './Hero'
import { ASSIDUITIES, exampleHabits, simulate, type Assiduity } from './simulation'

const WEEKS = [1, 2, 4, 8, 12]

/** Settings block: a sandbox where weeks of play can be invented, to try the game without waiting. */
export function SimulationPanel() {
  const { data, today, xp, saveMany, refreshClock } = useStore()
  const [assiduity, setAssiduity] = useState<Assiduity['id']>('average')
  const [asking, setAsking] = useState<'enter' | 'leave' | null>(null)
  const [report, setReport] = useState<string | null>(null)
  const [runs, setRuns] = useState(0)

  // The sandbox keeps its data in the browser; with a Supabase database there is nothing to copy.
  if (!isDemo) return null

  if (!isSandbox) {
    return (
      <section className="pt-8">
        <SectionTitle>⏳ Machine à voyager dans le temps</SectionTitle>
        <p className="pt-2 text-sm font-semibold text-muted">
          Teste le jeu sur plusieurs semaines sans attendre : le bac à sable travaille sur une copie de tes données, avec une horloge qu’on peut avancer et des semaines inventées. Tes vraies données ne sont ni lues ni modifiées tant que tu y es.
        </p>
        {asking === 'enter' ? (
          <div role="alert" className="card mt-3 flex flex-col gap-2 p-3">
            <p className="text-sm font-bold">Entrer dans le bac à sable ? La page se recharge. Une bannière rappelle que tu y es, et « Quitter » jette tout ce que tu y as fait.</p>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => { enterSandbox(); window.location.reload() }}>Oui, entrer</Button>
              <Button onClick={() => setAsking(null)}>Non</Button>
            </div>
          </div>
        ) : (
          <Button className="mt-3" onClick={() => setAsking('enter')}>Entrer dans le bac à sable</Button>
        )}
      </section>
    )
  }

  const chosen = ASSIDUITIES.find((a) => a.id === assiduity)!
  const hasHabits = data.habits.some((h) => !h.archived)
  const offset = simOffsetDays()

  const travel = (days: number) => {
    setSimOffsetDays(offset + days)
    refreshClock()
  }

  const play = (weeks: number) => {
    const to = addDays(today, weeks * 7)
    const made = simulate({ data, xp, from: today, to, assiduity: chosen, seed: `${today}|${weeks}|${chosen.id}|${runs}` })
    saveMany('validations', made.validations)
    saveMany('slips', made.slips)
    saveMany('tasks', made.tasks)
    saveMany('training_logs', made.logs)
    travel(weeks * 7)
    setRuns(runs + 1)
    const gained = made.validations.reduce((s, v) => s + v.xp_earned, 0) + made.tasks.reduce((s, t) => s + t.xp_earned, 0) + made.logs.reduce((s, l) => s + l.xp_earned, 0)
    setReport(`${weeks} ${weeks > 1 ? 'semaines jouées' : 'semaine jouée'} (${chosen.label.toLowerCase()}) : ${made.validations.length} quêtes validées, ${made.tasks.filter((t) => t.completed_at).length} missions accomplies, ${made.logs.length} séances, environ ${gained} XP. Va voir la Taverne et le Butin.`)
  }

  return (
    <section className="pt-8">
      <SectionTitle>⏳ Machine à voyager dans le temps</SectionTitle>
      <div className="card mt-3 flex flex-col gap-4 p-3" style={{ background: 'color-mix(in srgb, var(--color-lilac) 30%, var(--color-surface))' }}>
        <div className="flex flex-wrap items-center gap-2">
          <Sticker tone="gold">🧪 Bac à sable actif</Sticker>
          <span className="text-sm font-bold">{formatLongDay(today)}{offset > 0 ? ` · +${offset} j` : ''}</span>
        </div>

        {!hasHabits && (
          <div className="flex flex-col gap-2">
            <KeeperSays>Aucune quête à jouer ici. Je t’en prépare quelques-unes pour que la machine ait de quoi se mettre sous la dent.</KeeperSays>
            <Button variant="primary" className="self-start" onClick={() => saveMany('habits', exampleHabits(data.habit_templates, data.families, today))}>Ajouter des quêtes d’exemple</Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="font-display text-base">Quel héros es-tu pendant ces semaines ?</h3>
          <ChipTabs label="Assiduité" value={assiduity} options={ASSIDUITIES.map((a) => [a.id, a.label] as [Assiduity['id'], string])} onChange={setAssiduity} />
          <p className="text-[13px] font-semibold text-muted">{chosen.hint}.</p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-display text-base">Inventer des semaines</h3>
          <div className="flex flex-wrap gap-2">
            {WEEKS.map((w) => <Button key={w} disabled={!hasHabits} onClick={() => play(w)}>{w} {w > 1 ? 'semaines' : 'semaine'}</Button>)}
          </div>
          <p className="text-[13px] font-semibold text-muted">Les journées sont jouées selon ton assiduité (quêtes, missions, séances de salle), puis l’horloge avance. Le dernier jour reste vierge pour que tu le joues toi-même.</p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-display text-base">Avancer à la main</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => travel(1)}>Demain</Button>
            <Button onClick={() => travel(7)}>Dans une semaine</Button>
          </div>
          <p className="text-[13px] font-semibold text-muted">Rien n’est coché pendant le saut : les jours passés comptent comme manqués. Utile pour voir le boss se reposer ou une série se briser.</p>
        </div>

        {report && <p role="status" className="rounded-xl border-2 border-outline bg-surface p-2 text-sm font-bold">{report}</p>}

        {asking === 'leave' ? (
          <div role="alert" className="flex flex-col gap-2 rounded-xl border-[2.5px] border-warn bg-surface p-3">
            <p className="text-sm font-bold">Quitter le bac à sable ? Tout ce qui s’y est passé est jeté. Tes vraies données reviennent telles que tu les avais laissées.</p>
            <div className="flex gap-2">
              <Button className="!bg-warn !text-onaccent" onClick={() => { leaveSandbox(); window.location.reload() }}>Quitter et jeter</Button>
              <Button onClick={() => setAsking(null)}>Rester</Button>
            </div>
          </div>
        ) : (
          <Button className="self-start" onClick={() => setAsking('leave')}>Quitter le bac à sable…</Button>
        )}
      </div>
    </section>
  )
}
