import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Check, Copy, Printer } from 'lucide-react'
import { useOrderActions, useOrders, useSettings } from '../data/queries'
import { useNow } from '../lib/useNow'
import { useAction } from '../lib/useAction'
import { PHONE, useMediaQuery } from '../lib/useMediaQuery'
import { PRICING_LABEL, PRICING_MODES, isClosed, isRunning, partsAt, totalsOf, carName } from '../lib/calc'
import { dateOf, eur, skDate } from '../lib/format'
import { copyText, publicReportUrl } from '../lib/share'
import { plural } from '../lib/text'
import type { Order } from '../lib/types'
import Blueprint from '../components/Blueprint'
import StatusTag from '../components/StatusTag'
import TotalEdit from '../components/TotalEdit'

export default function Reports() {
  const orders = useOrders()
  const settings = useSettings()
  const actions = useOrderActions()
  const act = useAction()
  const list = orders.data ?? []
  const rate = settings.data?.hourly_rate ?? 28
  const billing = settings.data?.labor_billing
  const now = useNow(list.some(isRunning))
  const phone = useMediaQuery(PHONE)
  const [copied, setCopied] = useState<number | null>(null)

  const rows = list.filter(isClosed).sort((a, b) => Date.parse(b.closed_at ?? '') - Date.parse(a.closed_at ?? ''))
  const copy = async (id: number, token: string) => {
    if (await copyText(publicReportUrl(token))) { setCopied(id); setTimeout(() => setCopied(null), 2000) }
  }
  const empty = orders.isPending ? 'Načítavam…' : 'Zatiaľ žiadne uzavreté zákazky.'

  /** The sum with the other price levels under it, the same in the table and the phone list. */
  const total = (o: Order, t: ReturnType<typeof totalsOf>): ReactNode => (
    <>
      <TotalEdit order={o} grand={t.grand} computed={t.grand_computed} busy={act.busy} onSave={v => act.run(() => actions.updateOrder(o.id, { total_override: v }))} />
      <div className="muted" style={{ fontSize: 11 }}>
        {PRICING_MODES.map((mode, i) => (
          <Fragment key={mode}>{i > 0 && ' · '}<span style={o.parts_pricing === mode ? { fontWeight: 600 } : undefined}>{PRICING_LABEL[mode]} {eur(t.labor + partsAt(o, mode))}</span></Fragment>
        ))}
      </div>
    </>
  )
  const buttons = (o: Order): ReactNode => (
    <>
      <Link to={`/admin/reporty/${o.id}`} className="btn btn-secondary" style={{ minHeight: 30 }}><Printer size={14} strokeWidth={1.5} />Otvoriť</Link>
      <button className="btn btn-secondary" style={{ minHeight: 30 }} onClick={() => void copy(o.id, o.public_token)}><Copy size={14} strokeWidth={1.5} />{copied === o.id ? 'Skopírované ✓' : 'Odkaz'}</button>
      {o.status === 'unpaid' && <button className="btn btn-ghost" style={{ minHeight: 30 }} disabled={act.busy} onClick={() => void act.run(() => actions.updateOrder(o.id, { status: 'done' }))}><Check size={14} strokeWidth={1.5} />Uhradené</button>}
    </>
  )

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><div className="kicker">{rows.length} {plural(rows.length, 'report', 'reporty', 'reportov')}</div><h1>Reporty</h1></div>
      </div>
      {act.error && <div className="form-error" role="alert">{act.error}</div>}
      <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
        {phone ? (
          <div className="olist">
            {rows.map(o => {
              const t = totalsOf(o, rate, now, billing)
              return (
                <div key={o.id} className="olist-row">
                  <div className="olist-top">
                    <span className="muted num">#{o.number}</span>
                    <StatusTag status={o.status} />
                    <span className="olist-when muted">{o.closed_at ? `uzavreté ${skDate(dateOf(o.closed_at))}` : '—'}</span>
                  </div>
                  <div className="olist-title"><Link to={`/admin/zakazky/${o.id}`} style={{ color: 'inherit', textDecoration: 'none' }}><b>{carName(o.car)}</b></Link><span className="muted"> · {o.car.plate}</span></div>
                  <div className="olist-sub">{o.customer.name}</div>
                  <div className="olist-foot"><span className="olist-total" style={{ textAlign: 'right' }}>{total(o, t)}</span></div>
                  <div className="olist-actions">{buttons(o)}</div>
                </div>
              )
            })}
            {!rows.length && <div className="muted olist-empty">{empty}</div>}
          </div>
        ) : (
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
                    <td className="nowrap">{total(o, t)}</td>
                    <td><StatusTag status={o.status} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', gap: 4 }}>{buttons(o)}</span>
                    </td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan={6} className="muted">{empty}</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </Blueprint>
    </div>
  )
}
