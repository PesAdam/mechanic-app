import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useOrders, useSettings } from '../data/queries'
import { useNow } from '../lib/useNow'
import { byPlan, firstName, isClosed, isRunning, normClass, runningEntry, totalsOf, carName } from '../lib/calc'
import { dateOf, eur, hm, planLabel, skDateShort } from '../lib/format'
import { plural } from '../lib/text'
import type { Order } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'
import StatusTag from '../components/StatusTag'
import NewJobDialog from '../components/NewJobDialog'

type Filter = 'active' | 'unpaid' | 'done' | 'all'
const FILTERS: [Filter, string][] = [['active', 'Otvorené'], ['unpaid', 'Čaká na platbu'], ['done', 'Uhradené'], ['all', 'Všetky']]
type Sort = 'received' | 'plan'

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
  const rows = sort === 'plan' ? [...list.filter(matches)].sort(byPlan) : list.filter(matches)

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><div className="kicker">{rows.length} {plural(rows.length, 'zákazka', 'zákazky', 'zákaziek')}</div><h1>Zákazky</h1></div>
        <div className="admin-actions">
          <div className="seg">
            {FILTERS.map(([f, label]) => (
              <label key={f} className="seg-opt" style={{ minHeight: 36 }}>
                <input type="radio" name="o-filter" checked={filter === f} onChange={() => setFilter(f)} />{label}
              </label>
            ))}
          </div>
          <div className="seg" aria-label="Zoradiť">
            <label className="seg-opt" style={{ minHeight: 36 }}><input type="radio" name="o-sort" checked={sort === 'received'} onChange={() => setSort('received')} />Podľa prijatia</label>
            <label className="seg-opt" style={{ minHeight: 36 }}><input type="radio" name="o-sort" checked={sort === 'plan'} onChange={() => setSort('plan')} />Podľa plánu</label>
          </div>
          <input className="input" style={{ width: 240, minHeight: 36 }} placeholder="Hľadať: číslo, ŠPZ, zákazník…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Hľadať" />
          <button className="btn btn-primary blueprint" style={{ minHeight: 36 }} onClick={() => setNewOpen(true)}><Corners />+ Nová zákazka</button>
        </div>
      </div>

      <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>#</th><th>Prijaté</th><th>Plán</th><th>Auto · zákazník</th><th>ŠPZ</th><th>Mechanik</th><th>Čas</th><th>Diely</th><th>Spolu</th><th>Stav</th></tr></thead>
            <tbody>
              {rows.map(o => {
                const t = totalsOf(o, rate, now, billing)
                const run = runningEntry(o)
                return (
                  <tr key={o.id} className="clickable" onClick={() => nav(`/admin/zakazky/${o.id}`)}>
                    <td>{o.number}</td>
                    <td className="nowrap">{o.received_at ? skDateShort(dateOf(o.received_at)) : '—'}</td>
                    <td className="nowrap">{o.planned_at ? <span className={isClosed(o) ? 'muted' : ''}>{planLabel(o.planned_at, now)}</span> : <span className="muted">—</span>}</td>
                    <td><b>{carName(o.car)}</b> · {o.customer.name}<div className="muted" style={{ fontSize: 11 }}>{o.summary}</div></td>
                    <td className="nowrap">{o.car.plate}</td>
                    <td className="nowrap">{run ? <span style={{ color: 'var(--color-accent-700)' }}>● {firstName(run.user.name)}</span> : o.mechanic ? firstName(o.mechanic.name) : '—'}</td>
                    <td className={`num ${normClass(t.seconds, t.norm_seconds)}`}>{t.seconds ? hm(t.seconds) : '—'}{t.norm_seconds ? <div className="muted" style={{ fontSize: 10 }}>norma {hm(t.norm_seconds)}</div> : null}</td>
                    <td className="nowrap"><div>{eur(t.parts)} <span className="muted" style={{ fontSize: 10 }}>{o.parts_pricing.toUpperCase()}</span></div><div className="muted" style={{ fontSize: 10 }}>MOC {eur(t.parts_retail)} · NC {eur(t.parts_cost)}</div></td>
                    <td className="nowrap"><b>{eur(t.grand)}</b></td>
                    <td><StatusTag status={o.status} /></td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan={10} className="muted">{orders.isPending ? 'Načítavam…' : 'Nič nezodpovedá filtru.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Blueprint>

      <NewJobDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={id => nav(`/admin/zakazky/${id}`)} />
    </div>
  )
}
