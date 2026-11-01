import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useOrders, useSettings } from '../data/queries'
import { useNow } from '../lib/useNow'
import { byPlan, firstName, isClosed, isOverdue, isRunning, normClass, runningEntry, totalsOf, carName } from '../lib/calc'
import { dateOf, eur, hm, planLabel, skDateShort } from '../lib/format'
import { plural } from '../lib/text'
import type { Order } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'
import StatusTag from '../components/StatusTag'
import NewJobDialog from '../components/NewJobDialog'

type Filter = 'active' | 'unpaid' | 'done' | 'all'
const FILTERS: [Filter, string][] = [['active', 'Otvorené'], ['unpaid', 'Čaká na platbu'], ['done', 'Uhradené'], ['all', 'Všetky']]
type Sort = 'received' | 'closed' | 'paid' | 'plan'
const SORTS: [Sort, string][] = [['received', 'Podľa prijatia'], ['closed', 'Podľa uzavretia'], ['paid', 'Podľa úhrady'], ['plan', 'Podľa plánu']]
const at = (iso: string | null) => (iso ? Date.parse(iso) : 0)
/** Newest first; orders not closed (paid) yet keep their place at the end. */
const newest = (key: 'closed_at' | 'paid_at') => (a: Order, b: Order) => at(b[key]) - at(a[key])
/** null = as the API sends them, newest received first. */
const COMPARE: Record<Sort, ((a: Order, b: Order) => number) | null> = { received: null, closed: newest('closed_at'), paid: newest('paid_at'), plan: byPlan }

export default function Orders() {
  const orders = useOrders()
  const settings = useSettings()
  const list = orders.data ?? []
  const rate = settings.data?.hourly_rate ?? 28
  const billing = settings.data?.labor_billing
  const now = useNow(list.some(isRunning))
  const [filter, setFilter] = useState<Filter>('active')
  const [sort, setSort] = useState<Sort>('received')
  const [query, setQuery] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const nav = useNavigate()

  const matches = (o: Order) => {
    if (filter === 'active' && isClosed(o)) return false
    if (filter === 'unpaid' && o.status !== 'unpaid') return false
    if (filter === 'done' && o.status !== 'done') return false
    const s = query.trim().toLowerCase()
    if (!s) return true
    return [o.number, o.car.plate, o.car.make, o.car.model, o.customer.name, o.summary].some(v => v.toLowerCase().includes(s))
  }
  const found = list.filter(matches)
  const compare = COMPARE[sort]
  const rows = compare ? found.sort(compare) : found
  const showClosed = filter !== 'active'
  // Only the sorts that mean something for the tab: closed orders have no plan left, open ones no closing or payment yet.
  const sortable: Record<Sort, boolean> = { received: true, closed: showClosed, paid: filter === 'done' || filter === 'all', plan: filter === 'active' || filter === 'all' }

  // Paid orders are looked up by the day the money came in (the day Prehľad counts their zárobok), unpaid ones by the day they were closed.
  const pickFilter = (f: Filter) => {
    setFilter(f)
    if (f === 'done') setSort('paid')
    else if (f === 'unpaid') setSort('closed')
    else if (f === 'active' && (sort === 'closed' || sort === 'paid')) setSort('received')
  }

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><div className="kicker">{rows.length} {plural(rows.length, 'zákazka', 'zákazky', 'zákaziek')}</div><h1>Zákazky</h1></div>
        <div className="admin-actions">
          <div className="seg">
            {FILTERS.map(([f, label]) => (
              <label key={f} className="seg-opt" style={{ minHeight: 36 }}>
                <input type="radio" name="o-filter" checked={filter === f} onChange={() => pickFilter(f)} />{label}
              </label>
            ))}
          </div>
          <div className="seg" aria-label="Zoradiť">
            {SORTS.filter(([s]) => sortable[s]).map(([s, label]) => (
              <label key={s} className="seg-opt" style={{ minHeight: 36 }}><input type="radio" name="o-sort" checked={sort === s} onChange={() => setSort(s)} />{label}</label>
            ))}
          </div>
          <input className="input" style={{ width: 240, minHeight: 36 }} placeholder="Hľadať: číslo, ŠPZ, zákazník…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Hľadať" />
          <button className="btn btn-primary blueprint" style={{ minHeight: 36 }} onClick={() => setNewOpen(true)}><Corners />+ Nová zákazka</button>
        </div>
      </div>

      <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>#</th><th>Prijaté</th>{showClosed && <th title="Kedy bola zákazka uzavretá (vyfakturovaná) a pod tým kedy bola uhradená. Zárobok sa ráta podľa dňa úhrady.">Uzavreté</th>}<th>Plán</th><th>Auto · zákazník</th><th>ŠPZ</th><th>Mechanik</th><th>Čas</th><th>Práca</th><th>Diely</th><th title="Čo zostane z dielov: účtované zákazníkovi mínus nákupná cena (NC)">Marža na dieloch</th><th>Spolu</th><th>Stav</th></tr></thead>
            <tbody>
              {rows.map(o => {
                const t = totalsOf(o, rate, now, billing)
                const run = runningEntry(o)
                return (
                  <tr key={o.id} className="clickable" onClick={() => nav(`/admin/zakazky/${o.id}`)}>
                    <td>{o.number}</td>
                    <td className="nowrap">{o.received_at ? skDateShort(dateOf(o.received_at)) : '—'}</td>
                    {showClosed && <td className="nowrap">
                      {o.closed_at ? planLabel(o.closed_at, now) : <span className="muted">—</span>}
                      {o.paid_at && <div className="muted" style={{ fontSize: 10 }}>uhradené {planLabel(o.paid_at, now)}</div>}
                    </td>}
                    <td className="nowrap">{o.planned_at ? <span className={isOverdue(o, now) ? 'norm-bad' : isClosed(o) ? 'muted' : ''}>{isOverdue(o, now) ? 'mešká · ' : ''}{planLabel(o.planned_at, now)}</span> : <span className="muted">—</span>}</td>
                    <td><b>{carName(o.car)}</b> · {o.customer.name}<div className="muted" style={{ fontSize: 11 }}>{o.summary}</div></td>
                    <td className="nowrap">{o.car.plate}</td>
                    <td className="nowrap">{run ? <span style={{ color: 'var(--color-accent-700)' }}>● {firstName(run.user.name)}</span> : o.mechanic ? firstName(o.mechanic.name) : '—'}</td>
                    <td className={`num ${normClass(t.seconds, t.norm_seconds)}`}>{t.seconds ? hm(t.seconds) : '—'}{t.norm_seconds ? <div className="muted" style={{ fontSize: 10 }}>norma {hm(t.norm_seconds)}</div> : null}</td>
                    <td className="nowrap num">{eur(t.labor)}{t.labor_billing === 'norm' ? <div className="muted" style={{ fontSize: 10 }}>podľa normy</div> : null}</td>
                    <td className="nowrap num">{eur(t.parts)} <span className="muted" style={{ fontSize: 10 }}>{o.parts_pricing.toUpperCase()}</span></td>
                    <td className="nowrap num"><MarginCell order={o} retail={t.parts_retail} cost={t.parts_cost} billed={t.parts} /></td>
                    <td className="nowrap"><b>{eur(t.grand)}</b></td>
                    <td><StatusTag status={o.status} /></td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan={showClosed ? 13 : 12} className="muted">{orders.isPending ? 'Načítavam…' : 'Nič nezodpovedá filtru.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Blueprint>

      <NewJobDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={id => nav(`/admin/zakazky/${id}`)} />
    </div>
  )
}

/** MOC vs NC of the charged parts; the margin is what the customer pays for parts above their purchase price. */
function MarginCell({ order, retail, cost, billed }: { order: Order; retail: number; cost: number; billed: number }) {
  const margin = billed - cost
  const noNc = order.parts.filter(p => p.used && p.purchase_price === null).length
  return (
    <>
      <span className={margin > 0 ? 'norm-ok' : ''}>{eur(margin)}</span>
      <div className="muted" style={{ fontSize: 10 }}>MOC {eur(retail)} · NC {eur(cost)}</div>
      {order.parts_pricing === 'nc' && retail > cost && <div className="muted" style={{ fontSize: 10 }}>účtované v NC</div>}
      {noNc > 0 && <div className="norm-bad" style={{ fontSize: 10 }}>bez NC: {noNc} {plural(noNc, 'diel', 'diely', 'dielov')}</div>}
    </>
  )
}
