import type { ReactNode } from 'react'
import Blueprint from './Blueprint'
import { eur } from '../lib/format'
import { plural } from '../lib/text'
import type { Earnings, Pending } from '../lib/types'

type Money = Pick<Earnings, 'labor' | 'parts_margin' | 'parts_cost' | 'discount' | 'earnings' | 'orders'>

interface Props {
  /** Orders paid in the period: zárobok is money in hand. */
  money?: Money
  /** Closed in the period but not paid yet: shown under each figure, not counted in it. */
  pending?: Pending
  /** Štatistika: how each figure moved against the period before. */
  changes?: { labor: ReactNode; parts: ReactNode; total: ReactNode }
}

/** Zárobok the way the owner counts it: what the labor brought, what stays from the parts (billed − NC), and both together. */
export default function EarningsSplit({ money: m, pending, changes }: Props) {
  const adjusted = !m?.discount ? '' : m.discount > 0 ? ` − zľavy ${eur(m.discount)}` : ` + navýšenie ${eur(-m.discount)}`
  const waits = !!pending?.orders
  // A part billed under its NC makes the waiting margin negative.
  const waiting = (v: number) => (waits && v ? `${v > 0 ? '+' : '−'} ${eur(Math.abs(v))} čaká na platbu` : '')
  const cols: [string, string, string, string, ReactNode, boolean?][] = [
    ['Zárobok z práce', m ? eur(m.labor) : '…',
      m ? (m.orders ? `z ${m.orders} ${plural(m.orders, 'zaplatenej zákazky', 'zaplatených zákaziek', 'zaplatených zákaziek')}` : 'zatiaľ nič nezaplatené') : '',
      waiting(pending?.labor ?? 0), changes?.labor],
    ['Zárobok z dielov', m ? eur(m.parts_margin) : '…', m ? `účtované ${eur(m.parts_margin + m.parts_cost)} − nákup ${eur(m.parts_cost)}` : '',
      waiting(pending?.parts_margin ?? 0), changes?.parts],
    ['Zárobok spolu', m ? eur(m.earnings) : '…', m ? `práca + diely${adjusted}` : '',
      pending && waits ? `${waiting(pending.earnings) || 'čaká na platbu'} · ${pending.orders} ${plural(pending.orders, 'zákazka', 'zákazky', 'zákaziek')}` : '',
      changes?.total, true],
  ]
  return (
    <Blueprint className="card earn-split" style={{ padding: 0, gap: 0 }}>
      {cols.map(([k, v, note, wait, change, total]) => (
        <div key={k} role="group" aria-label={k}>
          <span className="card-kicker">{k}</span>
          <div className="kpi-v" style={total ? { color: 'var(--color-accent-700)' } : undefined}>{v}</div>
          <span className="card-meta">{note || ' '}</span>
          {waits && <span className="card-meta" style={{ color: 'var(--color-text)' }}>{wait || ' '}</span>}
          {changes && <span className="card-meta">{change}</span>}
        </div>
      ))}
    </Blueprint>
  )
}
