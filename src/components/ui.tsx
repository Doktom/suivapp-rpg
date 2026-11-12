import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const inputClass =
  'w-full min-h-11 rounded-xl border-2 border-outline bg-surface px-3 text-[16px] lg:text-sm text-ink'

export function Button({
  variant = 'ghost',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const look = variant === 'primary' ? 'bg-accent text-onaccent' : 'bg-surface text-ink'
  return (
    <button type="button" className={`pressable min-h-11 rounded-xl px-4 text-sm font-extrabold ${look} ${className}`} {...props} />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-bold">
      {label}
      {children}
    </label>
  )
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-32px)] max-w-lg rounded-2xl bg-ground p-5 text-ink backdrop:bg-black/50"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">{title}</h2>
        <Button onClick={() => ref.current?.close()}>Fermer</Button>
      </div>
      {children}
    </dialog>
  )
}

/** Outlined bar. `color` is any CSS color (a family color, a sticker token); defaults to the accent. */
export function ProgressBar({ percent, thin = false, color }: { percent: number; thin?: boolean; color?: string }) {
  return (
    <div className={`${thin ? 'h-2.5 border-[1.5px]' : 'h-4 border-2'} overflow-hidden rounded-full border-outline bg-track`}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(percent, 100))}%`, background: color ?? 'var(--color-accent)' }}
      />
    </div>
  )
}

/** The big striped XP bar, with its numbers written on top. */
export function XpBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = Math.max(0, Math.min((value / max) * 100, 100))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="relative h-6 overflow-hidden rounded-full border-[2.5px] border-outline bg-white"
    >
      <div className="xp-stripes h-full border-r-[2.5px] border-outline transition-[width] duration-700" style={{ width: `${percent}%` }} />
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-extrabold text-onsticker tabular-nums">{label}</span>
    </div>
  )
}

export function CheckButton({
  done,
  label,
  onClick,
  square = false,
}: {
  done: boolean
  label: string
  onClick: () => void
  square?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={done}
      className="flex size-11 flex-none items-center justify-center"
    >
      <span
        className={`flex size-8 items-center justify-center border-[2.5px] border-outline ${square ? 'rounded-lg' : 'rounded-[11px]'} ${done ? 'anim-pop bg-teal' : 'bg-surface'}`}
      >
        {done && (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--color-onsticker)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
        )}
      </span>
    </button>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-xl">{children}</h2>
}

export function FamilyDot({ color }: { color?: string }) {
  return <span className="inline-block size-3 flex-none rounded-full border-[1.5px] border-outline" style={{ background: color ?? '#9aa39a' }} aria-hidden="true" />
}

/** A family's color, faded for backgrounds. */
export const tint = (color: string | undefined, percent = 12) => `color-mix(in srgb, ${color ?? '#9aa39a'} ${percent}%, transparent)`

/** A small sticker: XP gains, counters. `tone` picks the sticker color. */
export function Sticker({ children, tone = 'gold', className = '' }: { children: ReactNode; tone?: 'gold' | 'teal' | 'coral' | 'pink' | 'sky'; className?: string }) {
  return <span className={`sticker ${className}`} style={{ background: `var(--color-${tone})` }}>{children}</span>
}

/** A block grouping the habits of one family: colored banner with the family name and its stat. */
export function FamilyCard({
  name,
  color,
  stat,
  count,
  id,
  children,
}: {
  name: string
  color?: string
  stat?: string
  count?: number
  id?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="card shrink-0 scroll-mt-4 overflow-hidden">
      <h2 className="flex items-baseline gap-2 border-b-[2.5px] border-outline px-3 py-2" style={{ background: tint(color, 38) }}>
        <span className="font-display text-lg">{name}</span>
        {stat && <span className="text-[13px] font-bold text-muted">· {stat}</span>}
        {count !== undefined && <span className="ml-auto text-[13px] font-extrabold tabular-nums">{count}</span>}
      </h2>
      <div className="px-3 [&>*:first-child]:border-t-0">{children}</div>
    </section>
  )
}
