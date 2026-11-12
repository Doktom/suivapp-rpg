import { useState } from 'react'
import { useStore } from '../data/store'
import { notificationsSupported, readReminders, showNotification, writeReminders, type ReminderSettings } from '../data/reminders'
import { applyTheme, readTheme, type ThemeChoice } from '../data/theme'
import type { XpSettings } from '../domain/types'
import { DEFAULT_XP } from '../domain/xp'
import { Button, inputClass } from './ui'

const THEMES: [ThemeChoice, string][] = [
  ['auto', 'Automatique'],
  ['light', 'Clair'],
  ['dark', 'Sombre'],
]

export function ThemeSetting() {
  const [theme, setTheme] = useState(readTheme)
  const pill = (active: boolean) => `min-h-[38px] rounded-md px-3 text-[13px] font-medium ${active ? 'bg-surface' : ''}`
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="pb-1 text-sm font-medium">Thème (sur cet appareil)</legend>
      <div className="flex w-fit seg">
        {THEMES.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={theme === value} className={pill(theme === value)} onClick={() => { applyTheme(value); setTheme(value) }}>
            {label}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-muted">« Automatique » suit le réglage du téléphone ou de l'ordinateur.</p>
    </fieldset>
  )
}

const XP_FIELDS: [keyof XpSettings, string][] = [
  ['habit', 'Quête validée (et premier niveau)'],
  ['level_step', 'Par niveau au-dessus'],
  ['routine_step', 'Par étape de routine'],
  ['task_low', 'Mission, priorité basse'],
  ['task_normal', 'Mission, priorité normale'],
  ['task_high', 'Mission, priorité haute'],
  ['subtask', 'Étape de mission'],
  ['block_bonus', 'Bonus de bloc terminé'],
]

export function XpSetting() {
  const { data, save, xp } = useStore()
  const profile = data.profile[0]
  const update = (patch: Partial<XpSettings>) => save('profile', { ...profile, xp: { ...xp, ...patch } })
  return (
    <section>
      <h2 className="pt-8 pb-1 font-display text-lg">Valeurs d'XP</h2>
      <p className="pb-3 text-[13px] text-muted">S'appliquent aux prochaines validations ; l'XP déjà gagnée ne change pas.</p>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {XP_FIELDS.map(([key, label]) => (
          <label key={key} className="flex min-h-11 items-center justify-between gap-3 border-t border-line text-sm">
            {label}
            <input
              type="number"
              min="0"
              max="500"
              className={`${inputClass} !w-20 text-right`}
              value={xp[key] as number}
              onChange={(e) => update({ [key]: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        ))}
        <label className="flex min-h-11 items-center justify-between gap-3 border-t border-line text-sm">
          Bonus de série (+10 % / +25 % / +50 %)
          <input type="checkbox" className="size-5" checked={xp.streak_bonus} onChange={(e) => update({ streak_bonus: e.target.checked })} />
        </label>
      </div>
      <Button className="mt-3" onClick={() => save('profile', { ...profile, xp: null })} disabled={JSON.stringify(xp) === JSON.stringify(DEFAULT_XP)}>
        Revenir aux valeurs par défaut
      </Button>
    </section>
  )
}

/** Downloads every table as one JSON file: a personal backup. */
export function ExportSetting() {
  const { data, today } = useStore()
  const download = () => {
    const blob = new Blob([JSON.stringify({ app: 'suivapp', exported_on: today, version: 2, data }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `suivapp-rpg-export-${today}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  const count = data.habits.length + data.validations.length + data.tasks.length + data.events.length
  return (
    <section>
      <h2 className="pt-8 pb-1 font-display text-lg">Mes données</h2>
      <p className="pb-3 text-[13px] text-muted">Un fichier JSON avec toutes vos habitudes, validations, tâches et événements ({count.toLocaleString('fr-FR')} éléments), à garder en sauvegarde.</p>
      <Button onClick={download}>Exporter mes données</Button>
    </section>
  )
}

export function ReminderSetting() {
  const [settings, setSettings] = useState(readReminders)
  const supported = notificationsSupported()
  const [permission, setPermission] = useState(supported ? Notification.permission : 'denied')
  const update = (next: ReminderSettings) => {
    setSettings(next)
    writeReminders(next)
  }
  const toggle = async () => {
    if (settings.enabled) return update({ ...settings, enabled: false })
    const result = supported && Notification.permission !== 'granted' ? await Notification.requestPermission() : permission
    setPermission(result)
    if (result === 'granted') {
      update({ ...settings, enabled: true })
      void showNotification('Suivapp RPG', 'Les rappels sont activés sur cet appareil.')
    }
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="pt-8 font-display text-lg">Rappels (sur cet appareil)</h2>
      {!supported ? (
        <p className="text-[13px] text-muted">Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d'abord l'app à l'écran d'accueil.</p>
      ) : (
        <>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5" checked={settings.enabled} onChange={toggle} />
            <span>Activer les rappels</span>
          </label>
          {permission === 'denied' && <p role="alert" className="text-sm text-warn">Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur.</p>}
          {settings.enabled && (
            <div className="flex flex-wrap gap-3">
              {(['morning', 'evening'] as const).map((slot) => (
                <label key={slot} className="flex items-center gap-2 text-sm">
                  {slot === 'morning' ? 'Matin' : 'Soir'}
                  <input type="time" className={`${inputClass} !w-auto`} value={settings[slot] ?? ''} onChange={(e) => update({ ...settings, [slot]: e.target.value || null })} />
                </label>
              ))}
            </div>
          )}
          <p className="text-[13px] text-muted">
            Le rappel résume ce qu'il reste à faire (habitudes, séance, cours). Sans serveur, il s'affiche quand l'app est ouverte ou installée et active en arrière-plan : au premier lancement après l'heure choisie sinon. Laisser un champ vide désactive ce rappel.
          </p>
        </>
      )}
    </section>
  )
}
