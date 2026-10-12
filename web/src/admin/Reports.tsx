import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Copy, Printer } from 'lucide-react'
import { useOrderActions, useOrders, useSettings } from '../data/queries'
import { useNow } from '../lib/useNow'
import { useAction } from '../lib/useAction'
import { isClosed, isRunning, totalsOf } from '../lib/calc'
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
                    <td><b>{o.car.make} {o.car.model}</b> · {o.customer.name}<div className="muted" style={{ fontSize: 11 }}>{o.car.plate}</div></td>
                    <td className="nowrap">
                      <div><b>{eur(t.grand)}</b> <span className="muted" style={{ fontSize: 10 }}>diely {o.parts_pricing.toUpperCase()}</span></div>
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
