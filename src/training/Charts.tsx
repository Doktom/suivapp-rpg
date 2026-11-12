/** Two small single-series charts (line and bars), drawn in SVG, with a hover / touch tooltip and a table view. */
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface Datum {
  /** Short x label, e.g. "3 nov." */
  label: string
  value: number
  /** Tooltip text. */
  tip: string
}

const HEIGHT = 180
const PAD = { top: 12, right: 12, bottom: 24, left: 44 }

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

/** Round axis ticks: 0, a nice step, up to just above the max. */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / 3
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100)
}

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
/** Axis labels stay short: 20 000 → "20 k". */
const short = (n: number) => (Math.abs(n) >= 10_000 ? `${fmt(n / 1000)} k` : fmt(n))

function Frame({ data, title, unit, children }: { data: Datum[]; title: string; unit: string; children: (width: number) => ReactNode }) {
  const { ref, width } = useWidth()
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-sm font-medium">{title} <span className="font-normal text-muted">({unit})</span></figcaption>
      <div ref={ref} className="relative w-full">{children(width)}</div>
      <details className="text-[13px] text-muted">
        <summary className="min-h-9 cursor-pointer leading-9">Voir en tableau</summary>
        <table className="w-full text-left">
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{fmt(d.value)} {unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

function Axis({ width, scaleY, values }: { width: number; scaleY: (v: number) => number; values: number[] }) {
  return (
    <g>
      {values.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={width - PAD.right} y1={scaleY(v)} y2={scaleY(v)} stroke="var(--color-line)" strokeWidth="1" />
          <text x={PAD.left - 6} y={scaleY(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
            {short(v)}
          </text>
        </g>
      ))}
    </g>
  )
}

function Tooltip({ x, y, width, text }: { x: number; y: number; width: number; text: string }) {
  const left = Math.min(Math.max(x, 70), width - 70)
  return (
    <div className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2 py-1 text-[12px] whitespace-nowrap text-ground shadow" style={{ left, top: y - 10 }}>
      {text}
    </div>
  )
}

export function LineChart({ data, title, unit }: { data: Datum[]; title: string; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <Frame data={data} title={title} unit={unit}>
      {(width) => {
        const axis = ticks(Math.max(...data.map((d) => d.value)))
        const top = axis[axis.length - 1]
        const innerW = width - PAD.left - PAD.right
        const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
        const y = (v: number) => PAD.top + (1 - v / top) * (HEIGHT - PAD.top - PAD.bottom)
        const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ')
        const pick = (clientX: number, rect: DOMRect) => {
          const rel = clientX - rect.left
          let best = 0
          data.forEach((_, i) => {
            if (Math.abs(x(i) - rel) < Math.abs(x(best) - rel)) best = i
          })
          setHover(best)
        }
        return (
          <>
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={`${title} : ${data.map((d) => `${d.label} ${fmt(d.value)} ${unit}`).join(', ')}`}
              onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
              onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
              onPointerLeave={() => setHover(null)}
              className="touch-pan-y"
            >
              <Axis width={width} scaleY={y} values={axis} />
              {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--color-muted)" strokeWidth="1" strokeDasharray="3 3" />}
              <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {data.map((d, i) => (
                <circle key={i} cx={x(i)} cy={y(d.value)} r={hover === i ? 5.5 : 4} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" />
              ))}
              {data.length > 0 && (
                <>
                  <text x={x(0)} y={HEIGHT - 6} fontSize="11" fill="var(--color-muted)" textAnchor={data.length === 1 ? 'middle' : 'start'}>{data[0].label}</text>
                  {data.length > 1 && <text x={x(data.length - 1)} y={HEIGHT - 6} fontSize="11" fill="var(--color-muted)" textAnchor="end">{data[data.length - 1].label}</text>}
                </>
              )}
            </svg>
            {hover !== null && <Tooltip x={x(hover)} y={y(data[hover].value)} width={width} text={data[hover].tip} />}
          </>
        )
      }}
    </Frame>
  )
}

export function BarChart({ data, title, unit }: { data: Datum[]; title: string; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <Frame data={data} title={title} unit={unit}>
      {(width) => {
        const axis = ticks(Math.max(...data.map((d) => d.value)))
        const top = axis[axis.length - 1]
        const innerW = width - PAD.left - PAD.right
        const slot = innerW / data.length
        const barW = Math.max(4, Math.min(36, slot - 2))
        const y = (v: number) => PAD.top + (1 - v / top) * (HEIGHT - PAD.top - PAD.bottom)
        const base = y(0)
        return (
          <>
            <svg width={width} height={HEIGHT} role="img" aria-label={`${title} : ${data.map((d) => `${d.label} ${fmt(d.value)} ${unit}`).join(', ')}`} onPointerLeave={() => setHover(null)}>
              <Axis width={width} scaleY={y} values={axis} />
              {data.map((d, i) => {
                const cx = PAD.left + slot * i + slot / 2
                const h = base - y(d.value)
                const r = Math.min(4, h, barW / 2)
                const x0 = cx - barW / 2
                const top0 = base - h
                return (
                  <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                    {/* Hit target: the whole column, wider than the bar. */}
                    <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={base - PAD.top} fill="transparent" />
                    {h > 0 && (
                      <path
                        d={`M${x0},${base} V${top0 + r} Q${x0},${top0} ${x0 + r},${top0} H${x0 + barW - r} Q${x0 + barW},${top0} ${x0 + barW},${top0 + r} V${base} Z`}
                        fill="var(--color-accent)"
                        opacity={hover === null || hover === i ? 1 : 0.55}
                      />
                    )}
                    {(data.length <= 6 || (data.length - 1 - i) % 3 === 0) && (
                      <text x={cx} y={HEIGHT - 6} fontSize="11" fill="var(--color-muted)" textAnchor="middle">{d.label}</text>
                    )}
                  </g>
                )
              })}
            </svg>
            {hover !== null && <Tooltip x={PAD.left + slot * hover + slot / 2} y={y(data[hover].value)} width={width} text={data[hover].tip} />}
          </>
        )
      }}
    </Frame>
  )
}
