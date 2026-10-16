import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Copy, Pencil, Printer, RotateCcw, X } from 'lucide-react'
import { useOrderActions, useOrders, useSettings } from '../data/queries'
import { useNow } from '../lib/useNow'
import { useAction } from '../lib/useAction'
import { isClosed, isRunning, totalsOf, carName } from '../lib/calc'
import type { Order } from '../lib/types'
import { dateOf, eur, skDate } from '../lib/format'
import { copyText, publicReportUrl } from '../lib/share'
import { plural } from '../lib/text'
import Blueprint from '../components/Blueprint'
import StatusTag from '../components/StatusTag'

export default function Reports() {
  const orders = useOrders()
  const settings = useSettings()
  const actions = useOrderActions()
  const act = useAction()
  const list = orders.data ?? []
  const rate = settings.data?.hourly_rate ?? 28
  const billing = settings.data?.labor_billing
  const now = useNow(list.some(isRunning))
  const [copied, setCopied] = useState<number | null>(null)

  const rows = list.filter(isClosed).sort((a, b) => Date.parse(b.closed_at ?? '') - Date.parse(a.closed_at ?? ''))
  const copy = async (id: number, token: string) => {
    if (await copyText(publicReportUrl(token))) { setCopied(id); setTimeout(() => setCopied(null), 2000) }
  }

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><div className="kicker">{rows.length} {plural(rows.length, 'report', 'reporty', 'reportov')}</div><h1>Reporty</h1></div>
      </div>
      {act.error && <div className="form-error" role="alert">{act.error}</div>}
      <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>#</th><th>Uzavreté</th><th>Auto · zákazník</th><th>Spolu</th><th>Stav</th><th></th></tr></thead>
            <tbody>
              {rows.map(o => {
                const t = totalsOf(o, rate, now, billing)
                return (
                  <tr key={o.id}>
                    <td>{o.number}</td>
                    <td className="nowrap">{o.closed_at ? skDate(dateOf(o.closed_at)) : '—'}</td>
                    <td><b>{carName(o.car)}</b> · {o.customer.name}<div className="muted" style={{ fontSize: 11 }}>{o.car.plate}</div></td>
                    <td className="nowrap">
                      <TotalEdit order={o} grand={t.grand} computed={t.grand_computed} busy={act.busy} onSave={v => act.run(() => actions.updateOrder(o.id, { total_override: v }))} />
                      <div className="muted" style={{ fontSize: 11 }}>
                        <span style={o.parts_pricing === 'moc' ? { fontWeight: 600 } : undefined}>MOC {eur(t.labor + t.parts_retail)}</span> · <span style={o.parts_pricing === 'nc' ? { fontWeight: 600 } : undefined}>NC {eur(t.labor + t.parts_cost)}</span>
                      </div>
                    </td>
                    <td><StatusTag status={o.status} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <Link to={`/admin/reporty/${o.id}`} className="btn btn-secondary" style={{ minHeight: 30 }}><Printer size={14} strokeWidth={1.5} />Otvoriť</Link>
                        <button className="btn btn-secondary" style={{ minHeight: 30 }} onClick={() => void copy(o.id, o.public_token)}><Copy size={14} strokeWidth={1.5} />{copied === o.id ? 'Skopírované ✓' : 'Odkaz'}</button>
                        {o.status === 'unpaid' && <button className="btn btn-ghost" style={{ minHeight: 30 }} disabled={act.busy} onClick={() => void act.run(() => actions.updateOrder(o.id, { status: 'done' }))}><Check size={14} strokeWidth={1.5} />Uhradené</button>}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan={6} className="muted">{orders.isPending ? 'Načítavam…' : 'Zatiaľ žiadne uzavreté zákazky.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Blueprint>
    </div>
  )
}

const round2 = (n: number): number => Math.round(n * 100) / 100

interface TotalEditProps { order: Order; grand: number; computed: number; busy: boolean; onSave: (total: number | null) => Promise<unknown> }

/** "Spolu" with a hand-edited total (zľava): the new amount in red next to the struck-through calculated one. */
function TotalEdit({ order, grand, computed, busy, onSave }: TotalEditProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const original = order.total_original ?? computed
  const edited = order.total_override !== null
  const diff = round2(grand - original)

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
          onKeyDown={e => { if (e.key === 'Escape') setDraft(null) }} style={{ width: 90, minHeight: 28, padding: '2px 6px' }} />
        <button type="submit" className="btn btn-ghost" style={{ minHeight: 28, padding: '0 6px' }} disabled={busy} aria-label="Uložiť"><Check size={14} strokeWidth={1.5} /></button>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '0 6px' }} onClick={() => setDraft(null)} aria-label="Zrušiť"><X size={14} strokeWidth={1.5} /></button>
      </form>
    )
  }

  return (
    <div>
      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
        <b style={edited ? { color: 'var(--color-bad)' } : undefined}>{eur(grand)}</b>
        {edited && <s className="muted" style={{ fontSize: 11 }}>{eur(original)}</s>}
        <span className="muted" style={{ fontSize: 10 }}>diely {order.parts_pricing.toUpperCase()}</span>
        <button className="btn btn-ghost" style={{ minHeight: 0, padding: 2 }} disabled={busy} title="Upraviť sumu (zľava)" aria-label="Upraviť sumu"
          onClick={() => setDraft(grand.toFixed(2).replace('.', ','))}><Pencil size={12} strokeWidth={1.5} /></button>
        {edited && <button className="btn btn-ghost" style={{ minHeight: 0, padding: 2 }} disabled={busy} title="Vrátiť pôvodnú sumu" aria-label="Vrátiť pôvodnú sumu"
          onClick={() => void onSave(null)}><RotateCcw size={12} strokeWidth={1.5} /></button>}
      </div>
      {edited && diff !== 0 && <div style={{ color: 'var(--color-bad)', fontSize: 11, fontWeight: 600 }}>{diff < 0 ? 'zľava' : 'navýšenie'} {diff < 0 ? '−' : '+'}{eur(Math.abs(diff))}{original > 0 ? ` (${Math.round(Math.abs(diff) / original * 100)} %)` : ''}</div>}
    </div>
  )
}
