import { useState, type FormEvent } from 'react'
import { useStore } from '../data/store'
import { childrenOf } from '../domain/automation'
import { formatShortDay } from '../domain/date'
import { describeRecurrence } from '../domain/recurrence'
import type { Task } from '../domain/types'
import { TaskDialog } from './TaskDialog'
import { CheckButton, inputClass, ProgressBar, Sticker } from './ui'

const PRIORITY: Record<Task['priority'], string> = { low: 'priorité basse', normal: '', high: 'priorité haute' }

export function TaskItem({ task, today, editable = false }: { task: Task; today: string; editable?: boolean }) {
  const { data, save, toggleTask, removeTask } = useStore()
  const [editing, setEditing] = useState(false)
  const [newStep, setNewStep] = useState('')
  const children = childrenOf(data.tasks, task.id)
  const isBlock = children.length > 0
  const isDone = task.completed_at !== null
  const late = !isDone && task.due_date !== null && task.due_date < today
  const list = data.task_lists.find((l) => l.id === task.list_id)
  const doneCount = children.filter((c) => c.completed_at).length
  const meta = [
    late ? 'En retard' : null,
    task.due_date ? formatShortDay(task.due_date) : null,
    list?.name,
    PRIORITY[task.priority] || null,
    task.recurrence ? `↻ ${describeRecurrence(task.recurrence)}` : null,
  ].filter(Boolean).join(' · ')

  const addStep = (e: FormEvent) => {
    e.preventDefault()
    if (!newStep.trim()) return
    save('tasks', {
      id: crypto.randomUUID(),
      parent_id: task.id,
      list_id: task.list_id,
      title: newStep.trim(),
      note: '',
      due_date: null,
      priority: 'normal',
      recurrence: null,
      previous_id: null,
      checklist_id: null,
      position: Math.max(-1, ...children.map((c) => c.position)) + 1,
      completed_at: null,
      xp_earned: 0,
    } satisfies Task)
    // A block that gains an open step is no longer finished.
    if (isDone) save('tasks', { ...task, completed_at: null, xp_earned: 0 })
    setNewStep('')
  }

  return (
    <div className="border-t border-line py-1.5">
      <div className="flex items-center gap-2">
        {isBlock ? (
          <span className="flex size-11 flex-none items-center justify-center text-xs font-medium text-muted tabular-nums">{doneCount}/{children.length}</span>
        ) : (
          <CheckButton square done={isDone} label={`${isDone ? 'Rouvrir' : 'Terminer'} : ${task.title}`} onClick={() => toggleTask(task)} />
        )}
        <div className="min-w-0 flex-1">
          <div className={`font-extrabold ${isDone ? 'text-muted line-through' : ''}`}>{task.title}</div>
          {meta && <div className={`text-[13px] ${late ? 'text-warn' : 'text-muted'}`}>{meta}</div>}
          {task.note && editable && <div className="text-[13px] text-muted">{task.note}</div>}
        </div>
        {task.xp_earned > 0 && <Sticker className="anim-pop flex-none">+{task.xp_earned} XP</Sticker>}
        {editable && (
          <>
            <button type="button" className="min-h-11 px-2 text-[13px] text-muted" onClick={() => setEditing(true)}>Modifier</button>
            <button type="button" className="min-h-11 px-2 text-[13px] text-muted" onClick={() => removeTask(task)}>Supprimer</button>
          </>
        )}
      </div>
      {isBlock && (
        <div className="pl-[52px]">
          <ProgressBar thin percent={(doneCount / children.length) * 100} />
          <div className="mt-1">
            {children.map((c) => (
              <div key={c.id} className="flex items-center gap-1">
                <CheckButton square done={c.completed_at !== null} label={`${c.completed_at ? 'Rouvrir' : 'Terminer'} : ${c.title}`} onClick={() => toggleTask(c)} />
                <span className={`min-w-0 flex-1 ${c.completed_at ? 'line-through' : ''}`}>{c.title}</span>
                {editable && <button type="button" className="min-h-11 px-2 text-[13px] text-muted" onClick={() => removeTask(c)}>Retirer</button>}
              </div>
            ))}
          </div>
        </div>
      )}
      {editable && (
        <form onSubmit={addStep} className="mt-1 pl-[52px]">
          <input className={inputClass} placeholder="Ajouter une étape" aria-label={`Ajouter une étape à ${task.title}`} value={newStep} onChange={(e) => setNewStep(e.target.value)} />
        </form>
      )}
      {editing && <TaskDialog task={task} onClose={() => setEditing(false)} />}
    </div>
  )
}
