import { useState, type FormEvent } from 'react'
import { Checklists } from '../components/Checklists'
import { TaskDialog } from '../components/TaskDialog'
import { TaskItem } from '../components/TaskItem'
import { Button, inputClass, chipClass, Sticker } from '../components/ui'
import { useStore, useToday } from '../data/store'
import { KeeperSays } from '../rpg/Hero'

export function Tasks() {
  const { data, save, removeList } = useStore()
  const today = useToday()
  const [listId, setListId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newList, setNewList] = useState('')
  const [showDone, setShowDone] = useState(false)

  const top = data.tasks.filter((t) => !t.parent_id && (listId === null || t.list_id === listId))
  const shown = top
    .filter((t) => showDone || !t.completed_at)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.title.localeCompare(b.title, 'fr'))
  const open = top.filter((t) => !t.completed_at)
  const lateCount = open.filter((t) => t.due_date !== null && t.due_date < today).length
  const selected = data.task_lists.find((l) => l.id === listId)
  const chip = (active: boolean) => chipClass(active, 'md')

  const addList = (e: FormEvent) => {
    e.preventDefault()
    if (!newList.trim()) return
    save('task_lists', { id: crypto.randomUUID(), name: newList.trim(), color: '#22B573' })
    setNewList('')
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 pb-4">
        <h1 className="font-display text-[30px] leading-tight">Le tableau des missions</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>Nouvelle mission</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <Sticker tone="gold">{open.length} {open.length > 1 ? 'missions' : 'mission'} à accomplir</Sticker>
        {lateCount > 0 && <Sticker tone="coral">⏰ {lateCount} en retard</Sticker>}
      </div>
      <div className="flex flex-wrap gap-2 pb-3">
        <button type="button" aria-pressed={listId === null} className={chip(listId === null)} onClick={() => setListId(null)}>Toutes</button>
        {data.task_lists.map((l) => (
          <button key={l.id} type="button" aria-pressed={listId === l.id} className={chip(listId === l.id)} onClick={() => setListId(l.id)}>{l.name}</button>
        ))}
      </div>
      <form onSubmit={addList} className="flex max-w-sm gap-2 pb-5">
        <input className={inputClass} placeholder="Nouvelle liste (ex. Ménage)" aria-label="Nom de la nouvelle liste" value={newList} onChange={(e) => setNewList(e.target.value)} />
        <Button type="submit">Créer</Button>
      </form>
      {shown.length === 0 && <KeeperSays className="max-w-3xl pb-3">{showDone || top.length === 0 ? 'Aucune mission ici. C’est louche : même les héros ont une liste de courses.' : 'Toutes les missions sont accomplies. Le tavernier est fier, et un peu jaloux.'}</KeeperSays>}
      {shown.length > 0 && (
        <div className="card max-w-3xl px-2 [&>*:first-child]:border-t-0">
          {shown.map((t) => <TaskItem key={t.id} task={t} today={today} editable />)}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-4">
        <Button onClick={() => setShowDone(!showDone)}>{showDone ? 'Masquer les accomplies' : 'Afficher les accomplies'}</Button>
        {selected && (
          <Button onClick={() => { removeList(selected); setListId(null) }}>Supprimer la liste « {selected.name} »</Button>
        )}
      </div>
      <Checklists />
      {creating && <TaskDialog task={null} onClose={() => setCreating(false)} />}
    </>
  )
}
