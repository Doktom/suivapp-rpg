import { useState } from 'react'
import { Button } from '../components/ui'
import { isDemo } from '../data/repo'
import { copyFromSuivapp, hasSuivappData } from './suivappCopy'

/** Settings block: bring the data of Suivapp (same browser) into this app. Shown only when there is something to copy. */
export function CopyFromSuivapp() {
  const [confirming, setConfirming] = useState(false)
  if (!isDemo || !hasSuivappData()) return null
  const run = () => {
    copyFromSuivapp()
    window.location.reload()
  }
  return (
    <section>
      <h2 className="pt-8 pb-1 font-display text-lg">Reprendre mes données de Suivapp</h2>
      <p className="pb-3 text-[13px] text-muted">
        Suivapp (la version sobre) a des données dans ce navigateur. Tu peux les copier ici : quêtes, validations, missions, agenda, entraînement. Suivapp n'est pas modifié ; les deux apps vivent ensuite chacune leur vie.
      </p>
      {confirming ? (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-warn p-3">
          <p className="text-sm">Les données actuelles de Suivapp RPG dans ce navigateur seront <strong>remplacées</strong> par celles de Suivapp.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={run}>Oui, copier</Button>
            <Button onClick={() => setConfirming(false)}>Finalement non</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setConfirming(true)}>Copier depuis Suivapp…</Button>
      )}
    </section>
  )
}
