import { useState } from 'react'
import { HabitDialog } from '../components/HabitDialog'
import { Button, chipClass, Dialog, FamilyCard, SectionTitle, Sticker } from '../components/ui'
import { useStore, useStreaks, useToday, useValidationIndex } from '../data/store'
import { addDays } from '../domain/date'
import { isPaused } from '../domain/schedule'
import { computeStreak, STREAK_UNIT } from '../domain/streak'
import { describeFrequency, describeTracking } from '../domain/describe'
import type { Habit, HabitTemplate } from '../domain/types'
import { KeeperSays } from '../rpg/Hero'

function HabitLine({ habit, onEdit }: { habit: Habit; onEdit: () => void }) {
  const { save } = useStore()
  const today = useToday()
  const index = useValidationIndex()
  const streak = useStreaks().get(habit.id) ?? computeStreak(habit, index, today)
  const paused = isPaused(habit, today)
  const unit = STREAK_UNIT[streak.unit]
  const tracking = describeTracking(habit)

  const togglePause = () => {
    const pauses = paused
      ? habit.pauses.map((p) => (p.to === null ? { ...p, to: addDays(today, -1) } : p)).filter((p) => p.to! >= p.from)
      : [...habit.pauses, { from: today, to: null }]
    save('habits', { ...habit, pauses })
  }

  const small = 'pressable min-h-11 rounded-xl bg-surface px-3 text-[13px] font-extrabold'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-dashed border-line py-2.5">
      <div className="min-w-48 flex-1">
        <div className="font-bold">{habit.name}</div>
        <div className="text-[13px] font-semibold text-muted">{describeFrequency(habit.frequency)}{tracking ? ` · ${tracking}` : ''}</div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {streak.current > 0 ? <Sticker tone="gold">🔥 {streak.current} {unit}</Sticker> : <span className="text-[12px] font-bold text-muted">série à lancer</span>}
          {streak.best > 0 && <Sticker tone="sky">🏆 record {streak.best} {unit}</Sticker>}
          {paused && <Sticker tone="pink">😴 en pause</Sticker>}
        </div>
      </div>
      <div className="flex gap-2 py-1">
        <button type="button" className={small} onClick={onEdit}>Modifier</button>
        <button type="button" className={small} onClick={togglePause}>{paused ? 'Reprendre' : 'Pause'}</button>
        <button type="button" className={small} onClick={() => save('habits', { ...habit, archived: !habit.archived })}>{habit.archived ? 'Restaurer' : 'Archiver'}</button>
      </div>
    </div>
  )
}

function Catalog({ onClose }: { onClose: () => void }) {
  const { data, save, remove } = useStore()
  const today = useToday()
  const [added, setAdded] = useState<string[]>([])

  const add = (t: HabitTemplate) => {
    const { builtin: _builtin, ...fields } = t
    save('habits', {
      ...fields,
      id: crypto.randomUUID(),
      description: '',
      time_of_day: null,
      start_date: today,
      end_date: null,
      pauses: [],
      archived: false,
    } satisfies Habit)
    setAdded((list) => [...list, t.id])
  }

  const families = [...data.families].sort((a, b) => a.position - b.position).filter((f) => data.habit_templates.some((t) => t.family_id === f.id))
  const [shown, setShown] = useState<string | null>(null)
  return (
    <Dialog title="Catalogue de quêtes" onClose={onClose}>
      <div className="flex flex-wrap gap-2 pb-3" role="group" aria-label="Familles">
        <button type="button" aria-pressed={shown === null} onClick={() => setShown(null)} className={chipClass(shown === null)}>Toutes</button>
        {families.map((f) => (
          <button key={f.id} type="button" aria-pressed={shown === f.id} onClick={() => setShown(shown === f.id ? null : f.id)} className={chipClass(shown === f.id)}>
            <span className="size-2.5 rounded-full border border-outline" style={{ background: f.color }} aria-hidden="true" />
            {f.name}
          </button>
        ))}
      </div>
      <div className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto">
        {families.filter((f) => shown === null || f.id === shown).map((f) => {
          const templates = data.habit_templates.filter((t) => t.family_id === f.id)
          return (
            <FamilyCard key={f.id} name={f.name} color={f.color} stat={f.stat_name} count={templates.length}>
              {templates.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-2 border-t-2 border-dashed border-line py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{t.name}</div>
                    <div className="text-[13px] font-semibold text-muted">{describeFrequency(t.frequency)}{describeTracking(t) ? ` · ${describeTracking(t)}` : ''}</div>
                  </div>
                  {!t.builtin && <button type="button" className="min-h-11 px-2 text-[13px] font-bold text-muted underline" onClick={() => remove('habit_templates', t.id)}>Retirer</button>}
                  <Button disabled={added.includes(t.id)} onClick={() => add(t)}>{added.includes(t.id) ? 'Au livre ✓' : 'Ajouter'}</Button>
                </div>
              ))}
            </FamilyCard>
          )
        })}
      </div>
    </Dialog>
  )
}

export function Habits() {
  const { data } = useStore()
  const [editing, setEditing] = useState<Partial<Habit> | null>(null)
  const [creating, setCreating] = useState(false)
  const [catalog, setCatalog] = useState(false)
  const active = data.habits.filter((h) => !h.archived)
  const archived = data.habits.filter((h) => h.archived)
  const families = [...data.families].sort((a, b) => a.position - b.position)
  const used = families.filter((f) => active.some((h) => h.family_id === f.id))
  const close = () => {
    setEditing(null)
    setCreating(false)
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <h1 className="font-display text-[30px] leading-tight">Le livre des quêtes</h1>
        <div className="flex gap-2">
          <Button onClick={() => setCatalog(true)}>Catalogue</Button>
          <Button variant="primary" onClick={() => setCreating(true)}>Nouvelle quête</Button>
        </div>
      </div>
      {active.length === 0 ? (
        <KeeperSays className="pb-4">Le livre est vide, héros. Pioche dans le catalogue : il y a des quêtes pour tous les gabarits.</KeeperSays>
      ) : (
        <p className="pb-4 text-sm font-bold text-muted">{active.length} {active.length > 1 ? 'quêtes' : 'quête'} au livre · {used.length} {used.length > 1 ? 'familles' : 'famille'} de compétences</p>
      )}
      {used.length > 1 && (
        <nav aria-label="Aller à une famille" className="flex flex-wrap gap-2 pb-4">
          {used.map((f) => (
            <a key={f.id} href={`#habits`} onClick={(e) => { e.preventDefault(); document.getElementById(`family-${f.id}`)?.scrollIntoView({ behavior: 'smooth' }) }} className={`${chipClass(false)} min-h-11`}>
              <span className="size-2.5 rounded-full border border-outline" style={{ background: f.color }} aria-hidden="true" />
              {f.name}
              <span className="text-muted tabular-nums">{active.filter((h) => h.family_id === f.id).length}</span>
            </a>
          ))}
        </nav>
      )}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {used.map((f) => {
          const habits = active.filter((h) => h.family_id === f.id)
          return (
            <FamilyCard key={f.id} id={`family-${f.id}`} name={f.name} color={f.color} stat={f.stat_name} count={habits.length}>
              {habits.map((h) => <HabitLine key={h.id} habit={h} onEdit={() => setEditing(h)} />)}
            </FamilyCard>
          )
        })}
        {active.some((h) => !h.family_id) && (
          <FamilyCard name="Sans famille">
            {active.filter((h) => !h.family_id).map((h) => <HabitLine key={h.id} habit={h} onEdit={() => setEditing(h)} />)}
          </FamilyCard>
        )}
      </div>
      <div className="pt-6">
        {archived.length > 0 && (
          <section>
            <SectionTitle>Quêtes rangées au grenier</SectionTitle>
            <div className="card mt-3 px-3 [&>*:first-child]:border-t-0">{archived.map((h) => <HabitLine key={h.id} habit={h} onEdit={() => setEditing(h)} />)}</div>
          </section>
        )}
      </div>
      {(editing || creating) && <HabitDialog habit={editing} onClose={close} />}
      {catalog && <Catalog onClose={() => setCatalog(false)} />}
    </>
  )
}
