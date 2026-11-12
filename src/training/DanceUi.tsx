import { STYLE_COLORS, STYLE_LABELS, STYLES, type DanceStyle } from './dance'

export const StyleDot = ({ style }: { style: DanceStyle }) => (
  <span aria-hidden="true" className="inline-block size-2.5 flex-none rounded-full" style={{ background: STYLE_COLORS[style] }} />
)

export function StylePicker({ value, onChange, allowAll = false }: { value: DanceStyle | ''; onChange: (s: DanceStyle | '') => void; allowAll?: boolean }) {
  const chip = (active: boolean) => `flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${active ? 'bg-accent text-onaccent' : 'bg-chip'}`
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Danse">
      {allowAll && <button type="button" aria-pressed={value === ''} className={chip(value === '')} onClick={() => onChange('')}>Toutes</button>}
      {STYLES.map((s) => (
        <button key={s} type="button" aria-pressed={value === s} className={chip(value === s)} onClick={() => onChange(s)}>
          {value !== s && <StyleDot style={s} />}
          {STYLE_LABELS[s]}
        </button>
      ))}
    </div>
  )
}
