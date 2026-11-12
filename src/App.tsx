import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type FormEvent } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout, type Route } from './components/Layout'
import { ReminderRunner } from './components/ReminderRunner'
import { Button, Field, inputClass } from './components/ui'
import { supabase } from './data/repo'
import { StoreProvider, useStoreStatus } from './data/store'
import { Agenda } from './pages/Agenda'
import { Habits } from './pages/Habits'
import { Trophies } from './pages/Trophies'
import { Settings } from './pages/Settings'
import { Tasks } from './pages/Tasks'
import { Training } from './training/TrainingPage'
import { Today } from './pages/Today'

const ROUTES: Record<Route, () => React.JSX.Element> = {
  today: Today,
  habits: Habits,
  training: Training,
  tasks: Tasks,
  agenda: Agenda,
  progress: Trophies,
  settings: Settings,
}

const readRoute = (): Route => {
  const hash = window.location.hash.slice(1)
  return hash in ROUTES ? (hash as Route) : 'today'
}

function Screens() {
  const { ready, error } = useStoreStatus()
  const [route, setRoute] = useState(readRoute)

  useEffect(() => {
    const onChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  if (!ready) return <p className="p-8 text-center text-muted">{error ?? 'Chargement…'}</p>
  const Page = ROUTES[route]
  return (
    <Layout route={route} error={error}>
      <Page />
      <ReminderRunner />
    </Layout>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    setStatus(error ? 'error' : 'sent')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-5">
      <h1 className="font-display text-[28px]">Suivapp RPG</h1>
      {status === 'sent' ? (
        <p>Lien de connexion envoyé. Ouvrez votre boîte mail.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Adresse e-mail">
            <input type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">Recevoir un lien de connexion</Button>
          {status === 'error' && <p role="alert" className="text-sm text-warn">L'envoi a échoué. Réessayez dans un instant.</p>}
        </form>
      )}
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <p className="p-8 text-center text-muted">Chargement…</p>
  if (supabase && !session) return <Login />
  return (
    <ErrorBoundary>
      <StoreProvider key={session?.user.id ?? 'demo'}>
        <Screens />
      </StoreProvider>
    </ErrorBoundary>
  )
}
