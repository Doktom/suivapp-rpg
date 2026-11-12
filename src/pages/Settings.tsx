import { useState, type FormEvent } from 'react'
import { ExportSetting, ReminderSetting, ThemeSetting, XpSetting } from '../components/SettingsExtras'
import { CopyFromSuivapp } from '../rpg/CopyFromSuivapp'
import { Button, Field, inputClass } from '../components/ui'
import { supabase } from '../data/repo'
import { useStore } from '../data/store'
import type { Family } from '../domain/types'

export function Settings() {
  const { data, save, removeFamily } = useStore()
  const profile = data.profile[0]
  const families = [...data.families].sort((a, b) => a.position - b.position)
  const [name, setName] = useState('')
  const [stat, setStat] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !stat.trim()) return
    const position = Math.max(-1, ...families.map((f) => f.position)) + 1
    save('families', { id: crypto.randomUUID(), name: name.trim(), stat_name: stat.trim(), color: '#3F6B52', position } satisfies Family)
    setName('')
    setStat('')
  }

  const move = (index: number, delta: number) => {
    const other = families[index + delta]
    if (!other) return
    const family = families[index]
    save('families', { ...family, position: other.position })
    save('families', { ...other, position: family.position })
  }

  const tryRemove = (family: Family) => {
    if (data.habits.some((h) => h.family_id === family.id && !h.archived)) {
      setNotice(`« ${family.name} » contient des quêtes : déplace-les ou archive-les d'abord.`)
      return
    }
    setNotice(null)
    removeFamily(family)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="pb-5 font-display text-[30px] leading-tight">L’arrière-boutique</h1>

      <Field label="Heure de bascule de la journée">
        <select className={`${inputClass} max-w-40`} value={profile.day_rollover_hour} onChange={(e) => save('profile', { ...profile, day_rollover_hour: Number(e.target.value) })}>
          {Array.from({ length: 13 }, (_, h) => <option key={h} value={h}>{h} h</option>)}
        </select>
      </Field>
      <div className="pt-5"><ThemeSetting /></div>

      <h2 className="pt-8 pb-3 font-display text-lg">Familles</h2>
      {notice && <p role="alert" className="pb-2 text-sm text-warn">{notice}</p>}
      <div>
        {families.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-center gap-2 border-t border-line py-2">
            <input type="color" aria-label={`Couleur de ${f.name}`} defaultValue={f.color} onBlur={(e) => save('families', { ...f, color: e.target.value })} className="size-11 flex-none rounded-lg bg-transparent" />
            <input aria-label="Nom de la famille" className={`${inputClass} min-w-36 flex-1 !w-auto`} defaultValue={f.name} onBlur={(e) => e.target.value.trim() && save('families', { ...f, name: e.target.value.trim() })} />
            <input aria-label={`Caractéristique de ${f.name}`} className={`${inputClass} min-w-28 flex-1 !w-auto`} defaultValue={f.stat_name} onBlur={(e) => e.target.value.trim() && save('families', { ...f, stat_name: e.target.value.trim() })} />
            <div className="flex text-muted">
              <button type="button" aria-label={`Monter ${f.name}`} disabled={i === 0} className="size-11 disabled:opacity-30" onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label={`Descendre ${f.name}`} disabled={i === families.length - 1} className="size-11 disabled:opacity-30" onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="min-h-11 px-2 text-[13px]" onClick={() => tryRemove(f)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="flex flex-wrap gap-2 border-t border-line pt-3">
        <input className={`${inputClass} min-w-36 flex-1 !w-auto`} placeholder="Nouvelle famille" aria-label="Nom de la nouvelle famille" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={`${inputClass} min-w-28 flex-1 !w-auto`} placeholder="Caractéristique" aria-label="Caractéristique de la nouvelle famille" value={stat} onChange={(e) => setStat(e.target.value)} />
        <Button type="submit">Ajouter</Button>
      </form>

      <ReminderSetting />
      <XpSetting />
      <ExportSetting />
      <CopyFromSuivapp />

      {supabase && <Button className="mt-8" onClick={() => supabase!.auth.signOut()}>Se déconnecter</Button>}
    </div>
  )
}
