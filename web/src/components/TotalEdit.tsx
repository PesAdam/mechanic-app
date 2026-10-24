import { useState } from 'react'
import { Check, Pencil, RotateCcw, X } from 'lucide-react'
import { isPaid } from '../lib/calc'
import { eur } from '../lib/format'
import type { Order } from '../lib/types'

const round2 = (n: number): number => Math.round(n * 100) / 100

interface Props {
  order: Order; grand: number; computed: number; busy: boolean; onSave: (total: number | null) => Promise<unknown>; large?: boolean
  /** Read-only; by default once the order is paid. */
  locked?: boolean
}

/**
 * "Spolu" with a hand-edited total (zľava): the new amount in red next to the struck-through calculated one.
 * `large` is the headline of the order's sums; the compact form sits in the reports table.
 */
export default function TotalEdit({ order, grand, computed, busy, onSave, large = false, locked }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  // A paid order keeps the price it was settled against; until then it can change, so compare with the live total.
  const paid = isPaid(order)
  const original = paid ? order.total_original ?? computed : computed
  const edited = order.total_override !== null
  const diff = round2(grand - original)
  const icon = large ? 16 : 12
  const iconBtn = large ? { minHeight: 0, padding: 4 } : { minHeight: 0, padding: 2 }

  const save = async () => {
    if (draft === null) return
    const v = round2(Number(draft.replace(',', '.').replace(/\s|€/g, '')))
    if (!draft.trim() || !Number.isFinite(v) || v < 0) return
    // Back at the calculated price means no zľava at all.
    await onSave(v === round2(computed) ? null : v)
    setDraft(null)
  }

  if (draft !== null) {
    return (
      <form style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }} onSubmit={e => { e.preventDefault(); void save() }}>
        <input className="input" autoFocus inputMode="decimal" aria-label="Nová suma" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setDraft(null) }} style={large ? { width: 110, minHeight: 36, padding: '2px 8px', fontSize: 18, textAlign: 'right' } : { width: 90, minHeight: 28, padding: '2px 6px' }} />
        <button type="submit" className="btn btn-ghost" style={{ minHeight: 28, padding: '0 6px' }} disabled={busy} aria-label="Uložiť"><Check size={icon} strokeWidth={1.5} /></button>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '0 6px' }} onClick={() => setDraft(null)} aria-label="Zrušiť"><X size={icon} strokeWidth={1.5} /></button>
      </form>
    )
  }

  const buttons = locked ?? paid ? null : <>
    <button className="btn btn-ghost" style={iconBtn} disabled={busy} title="Upraviť sumu (zľava)" aria-label="Upraviť sumu"
      onClick={() => setDraft(grand.toFixed(2).replace('.', ','))}><Pencil size={icon} strokeWidth={1.5} /></button>
    {edited && <button className="btn btn-ghost" style={iconBtn} disabled={busy} title="Vrátiť vypočítanú sumu" aria-label="Vrátiť pôvodnú sumu"
      onClick={() => void onSave(null)}><RotateCcw size={icon} strokeWidth={1.5} /></button>}
  </>
  const change = edited && diff !== 0 && `${diff < 0 ? 'zľava' : 'navýšenie'} ${diff < 0 ? '−' : '+'}${eur(Math.abs(diff))}${original > 0 ? ` (${Math.round(Math.abs(diff) / original * 100)} %)` : ''}`

  if (large) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <div style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
          {buttons}
          <span className="hd" style={{ fontSize: 26, lineHeight: 1, marginLeft: 4, color: edited ? 'var(--color-bad)' : undefined }}>{eur(grand)}</span>
        </div>
        {edited && <div className="muted" style={{ fontSize: 11 }}>vypočítané <s>{eur(original)}</s></div>}
        {change && <div style={{ color: 'var(--color-bad)', fontSize: 11, fontWeight: 600 }}>{change}</div>}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
        <b style={edited ? { color: 'var(--color-bad)' } : undefined}>{eur(grand)}</b>
        {edited && <s className="muted" style={{ fontSize: 11 }}>{eur(original)}</s>}
        <span className="muted" style={{ fontSize: 10 }}>diely {order.parts_pricing.toUpperCase()}</span>
        {buttons}
      </div>
      {change && <div style={{ color: 'var(--color-bad)', fontSize: 11, fontWeight: 600 }}>{change}</div>}
    </div>
  )
}
