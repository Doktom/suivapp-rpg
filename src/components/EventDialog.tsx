import { useState, type FormEvent } from 'react'
import { useStore } from '../data/store'
import type { CalendarEvent } from '../domain/types'
import { Button, Dialog, Field, inputClass } from './ui'

export function EventDialog({ event, defaultDay, onClose }: { event: CalendarEvent | null; defaultDay: string; onClose: () => void }) {
  const { save, remove } = useStore()
  const [title, setTitle] = useState(event?.title ?? '')
  const [day, setDay] = useState(event?.day ?? defaultDay)
  const [start, setStart] = useState(event?.start_time ?? '')
  const [end, setEnd] = useState(event?.end_time ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  const [color, setColor] = useState(event?.color ?? '#3F6B52')
  const badRange = !!start && !!end && end < start

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || badRange) return
    save('events', {
      id: event?.id ?? crypto.randomUUID(),
      title: title.trim(),
      day,
      start_time: start || null,
      end_time: end || null,
      note,
      color,
    } satisfies CalendarEvent)
    onClose()
  }

  return (
    <Dialog title={event ? "Modifier l'événement" : 'Nouvel événement'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Titre">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date">
            <input type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} required />
          </Field>
          <Field label="Début">
            <input type="time" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Fin">
            <input type="time" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <textarea className={`${inputClass} py-2`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Couleur">
          <input type="color" className="size-11 rounded-lg bg-transparent" value={color} onChange={(e) => setColor(e.target.value)} />
        </Field>
        {badRange && <p className="text-sm text-warn">La fin doit venir après le début.</p>}
        <Button type="submit" variant="primary" disabled={badRange}>Enregistrer</Button>
        {event && <Button onClick={() => { remove('events', event.id); onClose() }}>Supprimer l'événement</Button>}
      </form>
    </Dialog>
  )
}
