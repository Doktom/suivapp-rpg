import { useState } from 'react'
import { EventDialog } from '../components/EventDialog'
import { TaskDialog } from '../components/TaskDialog'
import { Button, inputClass, ProgressBar, tint } from '../components/ui'
import { useStore, useStreaks, useToday, useValidationIndex } from '../data/store'
import { agendaItems, quotaLines, type AgendaFilters, type AgendaItem, type ItemKind, type ItemState } from '../domain/agenda'
import { addDays, addMonths, firstOfMonth, formatLongDay, formatMonth, formatShortDay, mondayOf } from '../domain/date'
import { MOMENT_LABELS, MOMENTS, type CalendarEvent } from '../domain/types'

type View = 'day' | 'week' | 'month'

const VIEW_LABELS: Record<View, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' }
const KIND_LABELS: Record<ItemKind, string> = { habit: 'Quêtes', task: 'Missions', event: 'Événements', training: 'Donjon' }
const STATE_LABELS: Record<ItemState, string> = { done: 'fait', todo: 'à faire', missed: 'manqué', grace: 'jour de grâce', late: 'en retard' }
const WEEK_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const WEEK_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** Status of an item, drawn the same way everywhere: check when done, ring when to do, cross when missed. */
function StateIcon({ item }: { item: AgendaItem }) {
  const color = item.state === 'missed' || item.state === 'late' ? 'var(--color-warn)' : item.color
  const square = item.kind === 'task'
  const shape = square ? <rect x="2" y="2" width="14" height="14" rx="3" /> : <circle cx="9" cy="9" r="7" />
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="flex-none">
      {item.state === 'done' ? (
        <g fill={color} stroke={color} strokeWidth="1.5">
          {shape}
          <path d="M5.5 9.2 8 11.6l4.5-5" fill="none" stroke="var(--color-onaccent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : (
        <g fill="none" stroke={color} strokeWidth="2" strokeDasharray={item.state === 'grace' ? '3 2.5' : undefined}>
          {shape}
          {(item.state === 'missed' || item.state === 'late') && <path d="M6.5 6.5l5 5M11.5 6.5l-5 5" strokeLinecap="round" />}
        </g>
      )}
    </svg>
  )
}

function EventBlock({ item, onEvent, large = false }: { item: AgendaItem; onEvent: (e: CalendarEvent) => void; large?: boolean }) {
  return (
    <button
      type="button"
      // Training sessions are shown here too; they open in the Entraînement tab.
      onClick={() => (item.event ? onEvent(item.event) : (window.location.hash = '#training'))}
      className={`flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left ${large ? 'min-h-14' : 'min-h-11'}`}
      style={{ background: tint(item.color, 16), borderLeft: `4px solid ${item.color}` }}
    >
      <span className="text-[12px] font-semibold text-muted tabular-nums">{item.when}</span>
      <span className={`font-medium leading-tight ${large ? 'text-base' : 'text-sm'}`}>{item.kind === 'training' && item.state === 'done' ? `✓ ${item.title}` : item.title}</span>
      {large && item.event?.note && <span className="text-[13px] text-muted">{item.event.note}</span>}
    </button>
  )
}

/** Toggles an item from the agenda; null when it cannot be checked (a habit in the future). */
type Toggle = ((item: AgendaItem) => void) | null

const toggleLabel = (item: AgendaItem) => `${item.state === 'done' ? 'Annuler' : 'Valider'} : ${item.title}`

/** One habit or task as a compact pill; a tap checks it. */
function Pill({ item, onToggle }: { item: AgendaItem; onToggle: Toggle }) {
  const done = item.state === 'done'
  const bad = item.state === 'missed' || item.state === 'late'
  const cls = `inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full py-1 pr-3 pl-1.5 text-left text-[13px] ${done ? 'text-muted' : bad ? 'text-warn' : ''}`
  const style = { background: done ? 'var(--color-chip)' : bad ? tint('var(--color-warn)', 12) : tint(item.color, 14) }
  const content = (
    <>
      <StateIcon item={item} />
      <span className="truncate">{item.title}</span>
      {item.kind === 'habit' && /^\d/.test(item.when) && <span className="text-[12px] text-muted tabular-nums">{item.when}</span>}
    </>
  )
  return onToggle ? (
    <button type="button" className={cls} style={style} aria-pressed={done} aria-label={toggleLabel(item)} onClick={() => onToggle(item)}>{content}</button>
  ) : (
    <span title={`${item.title} — ${STATE_LABELS[item.state]}`} className={cls} style={style}>{content}</span>
  )
}

/** One full-width line, for the day view; a tap on the mark checks it. */
function Row({ item, onToggle }: { item: AgendaItem; onToggle: Toggle }) {
  const bad = item.state === 'missed' || item.state === 'late'
  return (
    <div className="flex min-h-11 items-center gap-3 border-t border-line">
      {onToggle ? (
        <button type="button" aria-pressed={item.state === 'done'} aria-label={toggleLabel(item)} onClick={() => onToggle(item)} className="-ml-3 flex size-11 flex-none items-center justify-center">
          <StateIcon item={item} />
        </button>
      ) : (
        <StateIcon item={item} />
      )}
      <span className={`min-w-0 flex-1 ${item.state === 'done' ? 'text-muted' : ''}`}>{item.title}</span>
      {/^\d/.test(item.when) && <span className="text-[13px] text-muted tabular-nums">{item.when}</span>}
      {item.state !== 'todo' && <span className={`text-[12px] ${bad ? 'text-warn' : 'text-muted'}`}>{STATE_LABELS[item.state]}</span>}
    </div>
  )
}

/** Splits a day's items into events, habits by moment, and tasks. */
function groups(items: AgendaItem[]) {
  return {
    events: items.filter((i) => i.kind === 'event' || i.kind === 'training'),
    moments: MOMENTS.map((m) => ({ moment: m, items: items.filter((i) => i.kind === 'habit' && i.moment === m) })).filter((g) => g.items.length > 0),
    tasks: items.filter((i) => i.kind === 'task'),
  }
}

const GroupLabel = ({ children }: { children: string }) => (
  <span className="w-16 flex-none pt-1.5 text-[12px] font-semibold tracking-wide text-muted uppercase">{children}</span>
)

function habitProgress(items: AgendaItem[]) {
  const habits = items.filter((i) => i.kind === 'habit')
  return { done: habits.filter((i) => i.state === 'done').length, total: habits.length }
}

/** A day of the week view: date on the left, its content on the right. */
function WeekDay({ day, index, items, today, onOpen, onEvent, onToggle }: {
  day: string
  index: number
  items: AgendaItem[]
  today: string
  onOpen: () => void
  onEvent: (e: CalendarEvent) => void
  onToggle: (item: AgendaItem, day: string) => void
}) {
  const toggle = (item: AgendaItem): Toggle => (item.kind === 'habit' && day > today ? null : (i) => onToggle(i, day))
  const { events, moments, tasks } = groups(items)
  const { done, total } = habitProgress(items)
  const isToday = day === today
  return (
    <div className={`flex flex-col gap-3 card p-3 sm:flex-row sm:gap-4 ${isToday ? 'border-accent' : ''} ${day < today ? 'opacity-80' : ''}`}>
      <button type="button" onClick={onOpen} aria-label={`Voir le ${formatLongDay(day)}`} className="flex flex-none items-center gap-3 text-left sm:w-24 sm:flex-col sm:items-start sm:gap-0.5">
        <span className={`text-[13px] font-semibold ${isToday ? 'text-accent' : 'text-muted'}`}>{isToday ? "Aujourd'hui" : WEEK_LONG[index]}</span>
        <span className="font-display text-2xl leading-none font-semibold tabular-nums">{Number(day.slice(8))}</span>
        <span className="text-[12px] text-muted">{formatShortDay(day).replace(/^\d+\s/, '')}</span>
        {total > 0 && (
          <span className="ml-auto w-20 sm:mt-1.5 sm:ml-0">
            <ProgressBar thin percent={(done / total) * 100} />
            <span className="text-[11px] text-muted tabular-nums">{done}/{total} quêtes</span>
          </span>
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {items.length === 0 && <p className="pt-1 text-[13px] text-muted">Rien de prévu.</p>}
        {events.length > 0 && (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {events.map((e) => <EventBlock key={e.key} item={e} onEvent={onEvent} />)}
          </div>
        )}
        {moments.map((g) => (
          <div key={g.moment} className="flex gap-2">
            <GroupLabel>{MOMENT_LABELS[g.moment]}</GroupLabel>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{g.items.map((i) => <Pill key={i.key} item={i} onToggle={toggle(i)} />)}</div>
          </div>
        ))}
        {tasks.length > 0 && (
          <div className="flex gap-2">
            <GroupLabel>Missions</GroupLabel>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{tasks.map((i) => <Pill key={i.key} item={i} onToggle={toggle(i)} />)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function DayView({ items, day, today, onEvent, onToggle }: {
  items: AgendaItem[]
  day: string
  today: string
  onEvent: (e: CalendarEvent) => void
  onToggle: (item: AgendaItem, day: string) => void
}) {
  const { events, moments, tasks } = groups(items)
  const toggle = (item: AgendaItem): Toggle => (item.kind === 'habit' && day > today ? null : (i) => onToggle(i, day))
  const section = (title: string, children: React.ReactNode) => (
    <section className="pb-4">
      <h2 className="pb-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {children}
    </section>
  )
  return (
    <div className="max-w-3xl">
      {items.length === 0 && <p className="border-t border-line py-4 text-muted">Rien de prévu ce jour.</p>}
      {events.length > 0 && section('Événements', <div className="flex flex-col gap-2">{events.map((e) => <EventBlock key={e.key} item={e} onEvent={onEvent} large />)}</div>)}
      {moments.map((g) => <div key={g.moment}>{section(MOMENT_LABELS[g.moment], g.items.map((i) => <Row key={i.key} item={i} onToggle={toggle(i)} />))}</div>)}
      {tasks.length > 0 && section('Missions', tasks.map((i) => <Row key={i.key} item={i} onToggle={toggle(i)} />))}
    </div>
  )
}

function MonthCell({ day, items, today, inMonth, onOpen }: { day: string; items: AgendaItem[]; today: string; inMonth: boolean; onOpen: () => void }) {
  const { done, total } = habitProgress(items)
  const events = items.filter((i) => i.kind === 'event' || i.kind === 'training')
  const tasks = items.filter((i) => i.kind === 'task')
  const lateTasks = tasks.filter((t) => t.state === 'late').length
  const isToday = day === today
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${formatLongDay(day)} : ${events.length} événements, ${done} sur ${total} quêtes, ${tasks.length} missions`}
      className={`flex min-h-20 min-w-0 flex-col gap-1 rounded-lg border p-1.5 text-left lg:min-h-28 ${isToday ? 'border-accent bg-surface' : 'border-line bg-surface'} ${inMonth ? '' : 'opacity-35'}`}
    >
      <span className={`flex size-6 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${isToday ? 'bg-accent text-onaccent' : ''}`}>{Number(day.slice(8))}</span>
      {events.slice(0, 2).map((e) => (
        <span key={e.key} className="w-full truncate rounded px-1 text-[11px] leading-5 font-medium lg:text-[12px]" style={{ background: tint(e.color, 18), borderLeft: `3px solid ${e.color}` }}>
          {e.title}
        </span>
      ))}
      {events.length > 2 && <span className="text-[11px] text-muted">+{events.length - 2}</span>}
      <span className="mt-auto flex w-full flex-col gap-0.5">
        {tasks.length > 0 && (
          <span className={`text-[11px] lg:text-[12px] ${lateTasks ? 'text-warn' : 'text-muted'}`}>
            {tasks.length} mission{tasks.length > 1 ? 's' : ''}
          </span>
        )}
        {total > 0 && day > today && <span className="hidden text-[11px] text-muted lg:block">{total} quêtes</span>}
        {total > 0 && day <= today && (
          <>
            <ProgressBar thin percent={(done / total) * 100} />
            <span className="hidden text-[11px] text-muted tabular-nums lg:block">{done}/{total} quêtes</span>
          </>
        )}
      </span>
    </button>
  )
}

export function Agenda() {
  const { data, toggleDay, toggleTask } = useStore()
  const today = useToday()
  const index = useValidationIndex()
  const streaks = useStreaks()
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(today)
  const [filters, setFilters] = useState<AgendaFilters>({ kinds: { habit: true, task: true, event: true, training: true }, familyId: '', listId: '' })
  const [eventDialog, setEventDialog] = useState<{ event: CalendarEvent | null; day: string } | null>(null)
  const [taskDay, setTaskDay] = useState<string | null>(null)
  const [taskBlock, setTaskBlock] = useState<string | null>(null)

  const itemsOf = (day: string) => agendaItems(data, day, today, index, streaks, filters)
  const openEvent = (event: CalendarEvent) => setEventDialog({ event, day: event.day })
  const toggleItem = (item: AgendaItem, day: string) => {
    if (item.kind === 'habit') {
      const habit = data.habits.find((h) => h.id === item.refId)
      if (habit && day <= today) toggleDay(habit, day)
    } else if (item.kind === 'task') {
      const task = data.tasks.find((t) => t.id === item.refId)
      if (task && !data.tasks.some((t) => t.parent_id === task.id)) toggleTask(task)
      else if (task) setTaskBlock(task.title)
    }
  }

  const step = (delta: number) => setAnchor(view === 'day' ? addDays(anchor, delta) : view === 'week' ? addDays(anchor, 7 * delta) : addMonths(firstOfMonth(anchor), delta))
  const monday = mondayOf(anchor)
  const title =
    view === 'day' ? formatLongDay(anchor) : view === 'week' ? `${formatShortDay(monday)} – ${formatShortDay(addDays(monday, 6))}` : formatMonth(anchor)
  const pill = (active: boolean) => `min-h-[38px] rounded-md px-3 text-[13px] font-medium ${active ? 'bg-surface' : ''}`
  const chip = (active: boolean) => `min-h-9 rounded-full px-3 text-[13px] font-medium ${active ? 'bg-accent text-onaccent' : 'bg-chip'}`
  const openDay = (day: string) => {
    setAnchor(day)
    setView('day')
  }
  const quota = filters.kinds.habit && !filters.listId ? quotaLines(data.habits, anchor, index, filters.familyId) : []

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <h1 className="font-display text-[30px] leading-tight">L’agenda du héros</h1>
        <div className="flex gap-2">
          <Button onClick={() => setTaskDay(anchor)}>+ Mission</Button>
          <Button variant="primary" onClick={() => setEventDialog({ event: null, day: anchor })}>+ Événement</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex seg">
          {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} className={pill(view === v)} onClick={() => setView(v)}>{VIEW_LABELS[v]}</button>
          ))}
        </div>
        <div className="flex w-full items-center text-sm sm:w-auto">
          <button type="button" aria-label="Période précédente" className="size-11 text-lg" onClick={() => step(-1)}>‹</button>
          <span className="min-w-0 flex-1 text-center font-display text-base font-semibold sm:min-w-44">{title}</span>
          <button type="button" aria-label="Période suivante" className="size-11 text-lg" onClick={() => step(1)}>›</button>
          <Button className="ml-1" onClick={() => setAnchor(today)}>Aujourd'hui</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pb-4">
        {(Object.keys(KIND_LABELS) as ItemKind[]).map((k) => (
          <button key={k} type="button" aria-pressed={filters.kinds[k]} className={chip(filters.kinds[k])} onClick={() => setFilters({ ...filters, kinds: { ...filters.kinds, [k]: !filters.kinds[k] } })}>
            {KIND_LABELS[k]}
          </button>
        ))}
        <select aria-label="Filtrer par famille" className={`${inputClass} !min-h-9 !w-auto`} value={filters.familyId} onChange={(e) => setFilters({ ...filters, familyId: e.target.value, listId: '' })}>
          <option value="">Toutes les familles</option>
          {[...data.families].sort((a, b) => a.position - b.position).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select aria-label="Filtrer par liste" className={`${inputClass} !min-h-9 !w-auto`} value={filters.listId} onChange={(e) => setFilters({ ...filters, listId: e.target.value, familyId: '' })}>
          <option value="">Toutes les listes</option>
          {data.task_lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {view !== 'month' && quota.length > 0 && (
        <section aria-label="Cette semaine" className="mb-4 card p-3">
          <h2 className="pb-1.5 text-[12px] font-semibold tracking-wide text-muted uppercase">Cette semaine · sans jour fixe</h2>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {quota.map((q) => (
              <div key={q.habit.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{q.habit.name}</span>
                <div className="w-16"><ProgressBar thin percent={(q.done / q.quota) * 100} /></div>
                <span className={`w-24 text-right text-[13px] tabular-nums ${q.done >= q.quota ? 'font-medium text-accent' : 'text-muted'}`}>{q.done} / {q.quota}{q.monthly ? ' ce mois' : ''}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {taskBlock && (
        <p role="status" className="mb-3 rounded-lg bg-chip px-3 py-2 text-[13px]">
          « {taskBlock} » est un bloc : coche ses étapes dans l'onglet Missions.{' '}
          <button type="button" className="font-medium underline" onClick={() => setTaskBlock(null)}>OK</button>
        </p>
      )}
      {view === 'day' && <DayView items={itemsOf(anchor)} day={anchor} today={today} onEvent={openEvent} onToggle={toggleItem} />}

      {view === 'week' && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((day, i) => (
            <WeekDay key={day} day={day} index={i} items={itemsOf(day)} today={today} onOpen={() => openDay(day)} onEvent={openEvent} onToggle={toggleItem} />
          ))}
        </div>
      )}

      {view === 'month' && (
        <div>
          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[12px] font-semibold text-muted">
            {WEEK_HEADERS.map((h) => <span key={h}>{h}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {(() => {
              const first = firstOfMonth(anchor)
              const end = addDays(addMonths(first, 1), -1)
              const cells: string[] = []
              for (let d = mondayOf(first); d <= end || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(d)
              return cells.map((day) => (
                <MonthCell key={day} day={day} items={itemsOf(day)} today={today} inMonth={day.slice(0, 7) === first.slice(0, 7)} onOpen={() => openDay(day)} />
              ))
            })()}
          </div>
          <p className="pt-2 text-[12px] text-muted">Barre : part des quêtes faites ce jour-là. Touche un jour pour voir le détail.</p>
        </div>
      )}

      {view !== 'month' && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-4 text-[12px] text-muted" aria-label="Légende">
          {(['done', 'todo', 'missed', 'grace'] as ItemState[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <StateIcon item={{ key: s, refId: s, kind: 'habit', title: '', when: '', order: '', state: s, color: '#3f6b52' }} />
              {STATE_LABELS[s]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <StateIcon item={{ key: 't', refId: 't', kind: 'task', title: '', when: '', order: '', state: 'todo', color: '#596159' }} />
            tâche
          </span>
        </div>
      )}

      {eventDialog && <EventDialog event={eventDialog.event} defaultDay={eventDialog.day} onClose={() => setEventDialog(null)} />}
      {taskDay && <TaskDialog task={null} defaultDue={taskDay} onClose={() => setTaskDay(null)} />}
    </>
  )
}
