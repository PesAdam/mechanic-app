import { Link } from 'react-router'
import { carName, firstName, isClosed, isOverdue, normClass, runningEntry, totalsOf } from '../lib/calc'
import { eur, hm, planLabel } from '../lib/format'
import type { LaborBilling, Order } from '../lib/types'
import StatusTag from './StatusTag'

interface Props { orders: Order[]; rate: number; now: number; billing?: LaborBilling; empty: string; showClosed?: boolean }

/** The orders table folded into one tappable row per order for a phone; the same figures, the detail a tap away. */
export default function OrderList({ orders, rate, now, billing, empty, showClosed }: Props) {
  if (!orders.length) return <div className="muted olist-empty">{empty}</div>
  return (
    <div className="olist">
      {orders.map(o => {
        const t = totalsOf(o, rate, now, billing)
        const run = runningEntry(o)
        const closed = isClosed(o)
        const late = isOverdue(o, now)
        return (
          <Link key={o.id} to={`/admin/zakazky/${o.id}`} className="olist-row">
            <div className="olist-top">
              <span className="muted num">#{o.number}</span>
              <StatusTag status={o.status} />
              <span className="olist-when">
                {showClosed && closed
                  ? <span className="muted">{o.paid_at ? `uhradené ${planLabel(o.paid_at, now)}` : o.closed_at ? `uzavreté ${planLabel(o.closed_at, now)}` : ''}</span>
                  : o.planned_at
                    ? <span className={late ? 'norm-bad' : closed ? 'muted' : ''}>{late ? 'mešká · ' : ''}{planLabel(o.planned_at, now)}</span>
                    : <span className="muted">bez plánu</span>}
              </span>
            </div>
            <div className="olist-title"><b>{carName(o.car)}</b>{o.car.plate ? <span className="muted"> · {o.car.plate}</span> : null}</div>
            <div className="olist-sub">{o.customer.name}{o.summary ? <span className="muted"> · {o.summary}</span> : null}</div>
            <div className="olist-foot">
              <span>{run ? <span style={{ color: 'var(--color-accent-700)' }}>● {firstName(run.user.name)}</span> : o.mechanic ? firstName(o.mechanic.name) : <span className="muted">bez mechanika</span>}</span>
              <span className={`num ${normClass(t.seconds, t.norm_seconds)}`}>{t.seconds ? hm(t.seconds) : '—'}</span>
              <span className="muted">diely {eur(t.parts)}</span>
              <b className="num olist-total">{eur(t.grand)}</b>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
