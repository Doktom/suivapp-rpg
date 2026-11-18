import { chipClass } from '../components/ui'
import { STYLE_COLORS, STYLE_LABELS, STYLES, type DanceStyle } from './dance'

export const StyleDot = ({ style }: { style: DanceStyle }) => (
  <span aria-hidden="true" className="inline-block size-3 flex-none rounded-full border-[1.5px] border-outline" style={{ background: STYLE_COLORS[style] }} />
)

export function StylePicker({ value, onChange, allowAll = false }: { value: DanceStyle | ''; onChange: (s: DanceStyle | '') => void; allowAll?: boolean }) {
  const chip = (active: boolean) => chipClass(active)
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
