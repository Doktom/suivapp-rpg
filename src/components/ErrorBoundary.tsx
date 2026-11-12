import { Component, type ReactNode } from 'react'

/** If a screen crashes, show a way out instead of a blank page. Data already saved is not affected. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main role="alert" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-5">
        <h1 className="font-display text-2xl">Un écran a planté</h1>
        <p className="text-muted">Tes données enregistrées ne sont pas touchées. Recharge la page ; si le problème revient, note ce que tu faisais.</p>
        <p className="rounded-lg bg-chip p-3 font-mono text-[12px] break-words">{this.state.error.message}</p>
        <button type="button" className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-onaccent" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </main>
    )
  }
}
