import type { Recurrence } from '../domain/types'
import { Field, inputClass } from './ui'

/** Repeat settings shared by tasks and checklists. */
export function RecurrenceFields({ value, onChange }: { value: Recurrence | null; onChange: (r: Recurrence | null) => void }) {
  const r = value ?? { mode: 'fixed', interval: 1, unit: 'week' }
  return (
    <div className="flex flex-col gap-3">
      <Field label="Répétition">
        <select className={inputClass} value={value?.mode ?? ''} onChange={(e) => onChange(e.target.value ? { ...r, mode: e.target.value as Recurrence['mode'] } : null)}>
          <option value="">Aucune</option>
          <option value="fixed">À date fixe (revient même si pas fait)</option>
          <option value="after">Après réalisation (compte depuis le jour où c'est fait)</option>
        </select>
      </Field>
      {value && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tous les">
            <input type="number" min="1" className={inputClass} value={value.interval} onChange={(e) => onChange({ ...value, interval: Math.max(1, Number(e.target.value)) })} />
          </Field>
          <Field label="Unité">
            <select className={inputClass} value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value as Recurrence['unit'] })}>
              <option value="day">jours</option>
              <option value="week">semaines</option>
              <option value="month">mois</option>
            </select>
          </Field>
        </div>
      )}
    </div>
  )
}
