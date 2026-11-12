import { useState, type FormEvent } from 'react'
import { useStore, useToday } from '../data/store'
import { describeRecurrence } from '../domain/recurrence'
import type { Checklist, Recurrence } from '../domain/types'
import { RecurrenceFields } from './RecurrenceFields'
import { Button, Dialog, Field, inputClass, SectionTitle } from './ui'

function ChecklistDialog({ checklist, onClose }: { checklist: Checklist | null; onClose: () => void }) {
  const { data, save, remove } = useStore()
  const [name, setName] = useState(checklist?.name ?? '')
  const [items, setItems] = useState((checklist?.items ?? []).join('\n'))
  const [listId, setListId] = useState(checklist?.list_id ?? '')
  const [recurrence, setRecurrence] = useState<Recurrence | null>(checklist?.recurrence ?? null)
  const lines = items.split('\n').map((l) => l.trim()).filter(Boolean)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || lines.length === 0) return
    save('checklists', { id: checklist?.id ?? crypto.randomUUID(), name: name.trim(), items: lines, list_id: listId || null, recurrence } satisfies Checklist)
    onClose()
  }

  return (
    <Dialog title={checklist ? 'Modifier la checklist' : 'Nouvelle checklist'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nom">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Éléments (un par ligne)">
          <textarea className={`${inputClass} py-2`} rows={6} value={items} onChange={(e) => setItems(e.target.value)} />
        </Field>
        <Field label="Liste">
          <select className={inputClass} value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">Aucune</option>
            {data.task_lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <RecurrenceFields value={recurrence} onChange={setRecurrence} />
        <p className="text-[13px] text-muted">Chaque lancement crée un nouveau bloc de tâches. Avec une répétition, le bloc suivant est créé automatiquement.</p>
        <Button type="submit" variant="primary" disabled={!name.trim() || lines.length === 0}>Enregistrer</Button>
        {checklist && <Button onClick={() => { remove('checklists', checklist.id); onClose() }}>Supprimer la checklist</Button>}
      </form>
    </Dialog>
  )
}

/** Reusable checklists: launching one creates a new block of tasks. */
export function Checklists() {
  const { data, launchChecklist } = useStore()
  const today = useToday()
  const [editing, setEditing] = useState<Checklist | null>(null)
  const [creating, setCreating] = useState(false)
  const [launched, setLaunched] = useState<string[]>([])
  const running = (c: Checklist) => data.tasks.some((t) => !t.parent_id && t.checklist_id === c.id && !t.completed_at)

  return (
    <section className="max-w-3xl pt-8">
      <div className="flex items-center justify-between gap-3 pb-2">
        <SectionTitle>Checklists réutilisables</SectionTitle>
        <Button onClick={() => setCreating(true)}>Nouvelle checklist</Button>
      </div>
      {data.checklists.length === 0 && <p className="border-t border-line py-4 text-muted">Aucune checklist.</p>}
      {data.checklists.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2">
          <div className="min-w-48 flex-1">
            <div className="font-medium">{c.name}</div>
            <div className="text-[13px] text-muted">
              {c.items.length} éléments{c.recurrence ? ` · ↻ ${describeRecurrence(c.recurrence)}` : ''}{running(c) ? ' · en cours' : ''}
            </div>
          </div>
          <button type="button" className="min-h-11 px-2 text-[13px] text-muted" onClick={() => setEditing(c)}>Modifier</button>
          <Button
            disabled={launched.includes(c.id)}
            onClick={() => {
              launchChecklist(c, today)
              setLaunched((l) => [...l, c.id])
            }}
          >
            {launched.includes(c.id) ? 'Lancée' : 'Lancer'}
          </Button>
        </div>
      ))}
      {(editing || creating) && <ChecklistDialog checklist={editing} onClose={() => { setEditing(null); setCreating(false) }} />}
    </section>
  )
}
