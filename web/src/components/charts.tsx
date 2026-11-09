import { useEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'
import Blueprint from './Blueprint'

/**
 * The Štatistika charts: a card with its table view, one hover/focus tooltip per chart and the marks
 * (stacked columns, horizontal bars, a heatmap, a line). Colors are the --viz-* roles in app.css.
 */

/** A round axis top just above the largest value: 1, 2, 2.5 or 5 × 10ⁿ. */
export function niceMax(value: number): number {
  if (value <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(value))
  return ([1, 2, 2.5, 5, 10].find(m => m * p >= value) ?? 10) * p
}

/** "1,2 tis. €" from a thousand up, whole euros below: axis ticks and labels on the marks. */
export const eurShort = (n: number): string =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1).replace('.', ',')} tis. €` : `${Math.round(n)} €`

interface Tip { x: number; y: number; body: ReactNode }

/** The chart frame owns one tooltip; a mark spreads `on(body)` and the tooltip sits above it, same on hover and focus. */
function useTip() {
  const frame = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const show = (el: Element, body: ReactNode) => {
    const f = frame.current?.getBoundingClientRect()
    if (!f) return
    const r = el.getBoundingClientRect()
    setTip({ x: Math.min(Math.max(r.left + r.width / 2 - f.left, 80), f.width - 80), y: r.top - f.top, body })
  }
  const on = (body: ReactNode) => ({
    onPointerEnter: (e: PointerEvent<Element>) => show(e.currentTarget, body),
    onFocus: (e: FocusEvent<Element>) => show(e.currentTarget, body),
    onPointerLeave: () => setTip(null),
    onBlur: () => setTip(null),
  })
  const layer = tip && <div className="viz-tip" role="status" style={{ left: tip.x, top: tip.y }}>{tip.body}</div>
  return { frame, on, layer, setTip }
}

/** Tooltip body: the value leads, its name follows; a short stroke of the series color keys each row. */
export function TipBody({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <>
      <div className="viz-tip-title">{title}</div>
      {rows.map(r => (
        <div key={r.label} className="viz-tip-row">
          {r.color && <i className="viz-key-line" style={{ background: r.color }} />}
          <b>{r.value}</b><span>{r.label}</span>
        </div>
      ))}
    </>
  )
}

/** Legend entry: a swatch for bars and cells, a line for lines (it mirrors the mark). */
export function Key({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return <span className="viz-key"><i className={line ? 'viz-key-line' : 'viz-key-box'} style={{ background: color }} />{label}</span>
}

interface CardProps { title: string; meta?: ReactNode; legend?: ReactNode; table?: ReactNode; children: ReactNode; empty?: string | false }

/** A chart in its frame; `table` is the same data as a table, a click away (the chart's accessible twin). */
export function ChartCard({ title, meta, legend, table, children, empty }: CardProps) {
  const [asTable, setAsTable] = useState(false)
  return (
    <Blueprint className="card viz" style={{ padding: '16px 18px', gap: 10 }}>
      <div className="viz-head">
        <span className="card-title">{title}</span>
        {meta && <span className="card-meta">{meta}</span>}
        {table && !empty && (
          <button type="button" className="btn btn-ghost viz-toggle" aria-pressed={asTable} onClick={() => setAsTable(v => !v)}>{asTable ? 'Graf' : 'Tabuľka'}</button>
        )}
      </div>
      {empty ? <div className="muted" style={{ fontSize: 13 }}>{empty}</div> : <>
        {legend && !asTable && <div className="viz-legend">{legend}</div>}
        {asTable ? <div style={{ overflowX: 'auto' }}>{table}</div> : children}
      </>}
    </Blueprint>
  )
}

interface ColumnsProps<T> {
  items: T[]
  /** Stacked bottom to top. */
  series: { label: string; color: string; value: (item: T) => number }[]
  label: (item: T) => string
  /** Which x labels to print (all by default); the tooltip and the table carry the rest. */
  showLabel?: (item: T, index: number) => boolean
  tip: (item: T) => ReactNode
  fmt: (n: number) => string
  ariaLabel: string
  /** Print the value on every cap (a few bars) instead of only on the tallest. */
  labelAll?: boolean
  /** The y ticks; off when every column is labeled anyway. */
  axis?: boolean
  height?: number
}

/** Columns from one baseline, stacked when there are several series; the tallest one carries its value. */
export function Columns<T>({ items, series, label, showLabel, tip, fmt, ariaLabel, labelAll, axis = true, height = 170 }: ColumnsProps<T>) {
  const { frame, on, layer } = useTip()
  const totals = items.map(it => series.reduce((a, s) => a + Math.max(0, s.value(it)), 0))
  const top = niceMax(Math.max(0, ...totals))
  const tallest = totals.indexOf(Math.max(...totals))
  return (
    <div className="viz-frame" ref={frame}>
      <div className="viz-cols-wrap">
        {axis && <div className="viz-y" style={{ height }} aria-hidden>{[top, top / 2, 0].map(v => <span key={v}>{fmt(v)}</span>)}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="viz-cols" style={{ height }} role="img" aria-label={ariaLabel}>
            {axis && <><i className="viz-grid" style={{ bottom: '50%' }} /><i className="viz-grid" style={{ bottom: '100%' }} /></>}
            {items.map((it, i) => (
              <button key={i} type="button" className="viz-col" aria-label={`${label(it)}: ${fmt(totals[i])}`} {...on(tip(it))}>
                {(labelAll || i === tallest) && totals[i] > 0 && <span className="viz-cap" style={{ bottom: `${(totals[i] / top) * 100}%` }}>{fmt(totals[i])}</span>}
                <span className="viz-stack" style={{ height: `${(totals[i] / top) * 100}%` }}>
                  {series.map(s => {
                    const v = Math.max(0, s.value(it))
                    return v > 0 ? <span key={s.label} style={{ flexGrow: v, background: s.color }} /> : null
                  })}
                </span>
              </button>
            ))}
          </div>
          <div className="viz-x" aria-hidden>{items.map((it, i) => <span key={i}>{!showLabel || showLabel(it, i) ? label(it) : ''}</span>)}</div>
        </div>
      </div>
      {layer}
    </div>
  )
}

interface BarsProps<T> {
  items: T[]
  label: (item: T) => ReactNode
  value: (item: T) => number
  fmt: (n: number) => string
  sub?: (item: T) => ReactNode
  tip?: (item: T) => ReactNode
  color?: string
}

/** A ranked list as horizontal bars: name, bar, value at its tip. */
export function Bars<T>({ items, label, value, fmt, sub, tip, color = 'var(--viz-1)' }: BarsProps<T>) {
  const { frame, on, layer } = useTip()
  const max = Math.max(0, ...items.map(value))
  return (
    <div className="viz-frame viz-bars" ref={frame}>
      {items.map((it, i) => {
        const v = value(it)
        return (
          <div key={i} className="viz-brow" tabIndex={tip ? 0 : undefined} {...(tip ? on(tip(it)) : {})}>
            <span className="viz-blabel">{label(it)}{sub && <span className="muted">{sub(it)}</span>}</span>
            <span className="viz-btrack"><span className="viz-bar" style={{ width: max > 0 ? `${(Math.max(0, v) / max) * 100}%` : 0, background: color }} /></span>
            <span className="viz-bval">{fmt(v)}</span>
          </div>
        )
      })}
      {layer}
    </div>
  )
}

/** Sequential steps of the accent hue, light (little) to dark (much); an empty cell stays neutral. */
const HEAT = ['var(--color-accent-200)', 'var(--color-accent-300)', 'var(--color-accent-400)', 'var(--color-accent-500)', 'var(--color-accent-600)', 'var(--color-accent-700)']

interface HeatmapProps {
  cols: string[]
  rows: { label: string; cells: number[]; total: string }[]
  tip: (row: string, col: string, value: number) => ReactNode
  cellLabel: (row: string, col: string, value: number) => string
  /** Which column headers to print. */
  showCol?: (index: number) => boolean
}

/** A grid of cells darker where there is more; each row ends with its total. */
export function Heatmap({ cols, rows, tip, cellLabel, showCol }: HeatmapProps) {
  const { frame, on, layer } = useTip()
  const max = Math.max(0, ...rows.flatMap(r => r.cells))
  const step = (v: number) => (v <= 0 || max <= 0 ? null : HEAT[Math.min(HEAT.length - 1, Math.ceil((v / max) * HEAT.length) - 1)])
  const grid = { gridTemplateColumns: `2.2em repeat(${cols.length}, minmax(0, 1fr)) 3.6em` }
  return (
    <div className="viz-frame" ref={frame}>
      <div className="viz-heat" style={grid} role="img" aria-label="Odpracované hodiny podľa dňa v týždni a hodiny">
        <span />
        {cols.map((c, i) => <span key={c} className="viz-heat-col">{!showCol || showCol(i) ? c : ''}</span>)}
        <span />
        {rows.map(r => [
          <span key={`${r.label}-l`} className="viz-heat-row">{r.label}</span>,
          ...r.cells.map((v, i) => {
            const fill = step(v)
            return <button key={`${r.label}-${i}`} type="button" className="viz-cell" style={fill ? { background: fill } : undefined}
              aria-label={cellLabel(r.label, cols[i], v)} {...on(tip(r.label, cols[i], v))} />
          }),
          <span key={`${r.label}-t`} className="viz-heat-total">{r.total}</span>,
        ])}
      </div>
      <div className="viz-scale" aria-hidden><span>menej</span>{HEAT.map(c => <i key={c} style={{ background: c }} />)}<span>viac</span></div>
      {layer}
    </div>
  )
}

/** Width of an element, kept current as the layout changes (the line chart draws in real pixels). */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width) || fallback))
    ro.observe(el)
    return () => ro.disconnect()
  }, [fallback])
  return { ref, width }
}

interface LineProps {
  labels: string[]
  series: { label: string; color: string; values: (number | null)[] }[]
  fmt: (n: number) => string
  ariaLabel: string
  height?: number
}

/** Lines over the same x positions on one axis; a crosshair reads every series at the pointer's x. */
export function Lines({ labels, series, fmt, ariaLabel, height = 200 }: LineProps) {
  const { ref, width } = useWidth(600)
  const [at, setAt] = useState<number | null>(null)
  const pad = { l: 52, r: 76, t: 12, b: 24 }
  const n = labels.length
  const top = niceMax(Math.max(0, ...series.flatMap(s => s.values.map(v => v ?? 0))))
  const x = (i: number) => pad.l + (n > 1 ? (i * (width - pad.l - pad.r)) / (n - 1) : 0)
  const y = (v: number) => pad.t + (1 - Math.max(0, v) / top) * (height - pad.t - pad.b)
  const lastOf = (values: (number | null)[]) => values.reduce<number>((last, v, i) => (v === null ? last : i), -1)
  const path = (values: (number | null)[]) => values.map((v, i) => (v === null ? '' : `${i === 0 || values[i - 1] === null ? 'M' : 'L'}${x(i)},${y(v)}`)).join('')
  // End labels only where they do not collide; the legend and the crosshair carry the rest.
  const ends = series.map(s => ({ s, i: lastOf(s.values) })).filter(e => e.i >= 0)
  const shown = ends.filter((e, k) => ends.slice(0, k).every(o => Math.abs(y(o.s.values[o.i] ?? 0) - y(e.s.values[e.i] ?? 0)) > 14))
  const band = n > 1 ? (width - pad.l - pad.r) / (n - 1) : width

  return (
    <div className="viz-frame" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block', overflow: 'visible' }}>
        {[0, top / 2, top].map(v => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} className="viz-svg-grid" />
            <text x={pad.l - 8} y={y(v)} dy="0.32em" textAnchor="end" className="viz-svg-tick">{fmt(v)}</text>
          </g>
        ))}
        {labels.map((l, i) => <text key={l} x={x(i)} y={height - 6} textAnchor="middle" className="viz-svg-tick">{l}</text>)}
        {at !== null && <line x1={x(at)} x2={x(at)} y1={pad.t} y2={height - pad.b} className="viz-svg-cross" />}
        {series.map(s => <path key={s.label} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
        {ends.map(({ s, i }) => <circle key={s.label} cx={x(i)} cy={y(s.values[i] ?? 0)} r={4} fill={s.color} className="viz-svg-dot" />)}
        {at !== null && series.map(s => s.values[at] !== null && <circle key={`h-${s.label}`} cx={x(at)} cy={y(s.values[at] ?? 0)} r={4} fill={s.color} className="viz-svg-dot" />)}
        {shown.map(({ s, i }) => <text key={`e-${s.label}`} x={x(i) + 10} y={y(s.values[i] ?? 0)} dy="0.32em" className="viz-svg-end">{fmt(s.values[i] ?? 0)}</text>)}
        {labels.map((l, i) => (
          <rect key={`hit-${l}`} x={x(i) - band / 2} y={pad.t} width={band} height={height - pad.t - pad.b} fill="transparent" tabIndex={0}
            aria-label={`${l}: ${series.map(s => `${s.label} ${s.values[i] === null ? '—' : fmt(s.values[i] ?? 0)}`).join(', ')}`}
            onPointerEnter={() => setAt(i)} onFocus={() => setAt(i)} onPointerLeave={() => setAt(null)} onBlur={() => setAt(null)} />
        ))}
      </svg>
      {at !== null && (
        <div className="viz-tip" role="status" style={{ left: Math.min(Math.max(x(at), 80), width - 80), top: pad.t }}>
          <TipBody title={labels[at]} rows={series.map(s => ({ label: s.label, value: s.values[at] === null ? '—' : fmt(s.values[at] ?? 0), color: s.color }))} />
        </div>
      )}
    </div>
  )
}
