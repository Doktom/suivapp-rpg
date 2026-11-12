import { useState } from 'react'
import { HabitDialog } from '../components/HabitDialog'
import { Button, Dialog, FamilyCard, SectionTitle, tint } from '../components/ui'
import { useStore, useStreaks, useToday, useValidationIndex } from '../data/store'
import { addDays } from '../domain/date'
import { isPaused } from '../domain/schedule'
import { computeStreak, STREAK_UNIT } from '../domain/streak'
import { describeFrequency, describeTracking } from '../domain/describe'
import type { Habit, HabitTemplate } from '../domain/types'

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

  return (
    <div className="flex flex-wrap items-center gap-x-3 border-t border-line py-2">
      <div className="min-w-48 flex-1">
        <div className="font-medium">{habit.name}</div>
        <div className="text-[13px] text-muted">
          {describeFrequency(habit.frequency)}{tracking ? ` · ${tracking}` : ''} · série {streak.current} {unit} · record {streak.best} {unit}
          {paused ? ' · en pause' : ''}
        </div>
      </div>
      <div className="flex text-[13px] text-muted">
        <button type="button" className="min-h-11 px-2" onClick={onEdit}>Modifier</button>
        <button type="button" className="min-h-11 px-2" onClick={togglePause}>{paused ? 'Reprendre' : 'Pause'}</button>
        <button type="button" className="min-h-11 px-2" onClick={() => save('habits', { ...habit, archived: !habit.archived })}>{habit.archived ? 'Restaurer' : 'Archiver'}</button>
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
      <div className="flex flex-wrap gap-1.5 pb-3" role="group" aria-label="Familles">
        <button type="button" aria-pressed={shown === null} onClick={() => setShown(null)} className={`min-h-9 rounded-full px-3 text-[13px] font-medium ${shown === null ? 'bg-accent text-onaccent' : 'bg-chip'}`}>Toutes</button>
        {families.map((f) => (
          <button key={f.id} type="button" aria-pressed={shown === f.id} onClick={() => setShown(shown === f.id ? null : f.id)} className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium" style={{ background: shown === f.id ? f.color : tint(f.color, 18), color: shown === f.id ? '#fff' : undefined }}>
            {shown !== f.id && <span className="size-2 rounded-full" style={{ background: f.color }} aria-hidden="true" />}
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
                <div key={t.id} className="flex items-center gap-2 border-t border-line py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-[13px] text-muted">{describeFrequency(t.frequency)}{describeTracking(t) ? ` · ${describeTracking(t)}` : ''}</div>
                  </div>
                  {!t.builtin && <button type="button" className="min-h-11 px-2 text-[13px] text-muted" onClick={() => remove('habit_templates', t.id)}>Retirer</button>}
                  <Button disabled={added.includes(t.id)} onClick={() => add(t)}>{added.includes(t.id) ? 'Ajoutée' : 'Ajouter'}</Button>
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
      {active.length === 0 && <p className="card p-4 text-muted">Aucune quête dans le livre. Pioche dans le catalogue : il y en a pour tous les héros.</p>}
      {used.length > 1 && (
        <nav aria-label="Aller à une famille" className="flex flex-wrap gap-1.5 pb-4">
          {used.map((f) => (
            <a key={f.id} href={`#habits`} onClick={(e) => { e.preventDefault(); document.getElementById(`family-${f.id}`)?.scrollIntoView({ behavior: 'smooth' }) }} className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium" style={{ background: tint(f.color, 18) }}>
              <span className="size-2 rounded-full" style={{ background: f.color }} aria-hidden="true" />
              {f.name}
              <span className="text-muted tabular-nums">{active.filter((h) => h.family_id === f.id).length}</span>
            </a>
          ))}
        </nav>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
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
            <SectionTitle>Archivées</SectionTitle>
            <div className="pt-2">{archived.map((h) => <HabitLine key={h.id} habit={h} onEdit={() => setEditing(h)} />)}</div>
          </section>
        )}
      </div>
      {(editing || creating) && <HabitDialog habit={editing} onClose={close} />}
      {catalog && <Catalog onClose={() => setCatalog(false)} />}
    </>
  )
}
