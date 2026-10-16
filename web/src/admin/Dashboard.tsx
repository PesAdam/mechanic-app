import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useDashboard, useOrders, useSettings } from '../data/queries'
import { useNow } from '../lib/useNow'
import { firstName, isRunning, totalsOf, carName } from '../lib/calc'
import { eur, hm, hoursSk } from '../lib/format'
import { plural } from '../lib/text'
import type { Period } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'
import StatusTag from '../components/StatusTag'
import NewJobDialog from '../components/NewJobDialog'

const PERIODS: [Period, string][] = [['week', 'Týždeň'], ['month', 'Mesiac'], ['year', 'Rok']]

/** 1d · Prehľad — parts spend, hours, margin and the open orders. */
export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('week')
  const dash = useDashboard(period)
  const orders = useOrders()
  const settings = useSettings()
  const [newOpen, setNewOpen] = useState(false)
  const nav = useNavigate()

  const d = dash.data
  const list = orders.data ?? []
  const rate = settings.data?.hourly_rate ?? d?.rate ?? 28
  const billing = settings.data?.labor_billing
  const now = useNow(list.some(isRunning))
  const open = list.filter(o => o.status !== 'done')
  const maxBar = Math.max(1, ...(d?.bars.flatMap(b => [b.labor, b.parts]) ?? []))
  const maxMech = Math.max(0.1, ...(d?.mechanics.map(m => m.hours) ?? []))

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><div className="kicker">{d?.label ?? '…'}</div><h1>Prehľad</h1></div>
        <div className="admin-actions">
          <div className="seg">
            {PERIODS.map(([p, label]) => (
              <label key={p} className="seg-opt" style={{ minHeight: 36 }}>
                <input type="radio" name="d-period" checked={p === period} onChange={() => setPeriod(p)} />{label}
              </label>
            ))}
          </div>
          <button className="btn btn-primary blueprint" style={{ minHeight: 36 }} onClick={() => setNewOpen(true)}><Corners />+ Nová zákazka</button>
        </div>
      </div>

      {dash.isError && !d && <Blueprint style={{ padding: 14 }}><div style={{ fontSize: 13 }}>Prehľad sa nepodarilo načítať. <button className="btn btn-ghost" onClick={() => void dash.refetch()}>Skúsiť znova</button></div></Blueprint>}

      <div className="kpi-grid">
        <Kpi k="Diely nakúpené · NC" v={d ? eur(d.kpi.parts) : '…'} m={d ? `predané za ${eur(d.kpi.parts_retail)} MOC · ${d.kpi.active_days} ${plural(d.kpi.active_days, 'aktívny deň', 'aktívne dni', 'aktívnych dní')}` : ''} />
        <Kpi k="Hodiny pri autách" v={d ? hoursSk(d.kpi.hours) : '…'} m={d ? `${eur(d.kpi.labor)} práca` : ''}
          extra={d && d.kpi.efficiency !== null ? <span className={d.kpi.efficiency >= 100 ? 'norm-ok' : 'norm-bad'}> · efektivita {d.kpi.efficiency} % (norma {hoursSk(d.kpi.norm_hours)})</span> : null} />
        <Kpi k="Fakturované" v={d ? eur(d.kpi.billed) : '…'} m={d ? (d.kpi.margin === null ? 'bez uzavretých zákaziek' : `marža ${d.kpi.margin} %`) : ''} />
        <Kpi k="Zaplatené" v={d ? eur(d.kpi.paid) : '…'} m={d ? `${d.kpi.paid_count} ${plural(d.kpi.paid_count, 'doklad uhradený', 'doklady uhradené', 'dokladov uhradených')}` : ''} />
        <Kpi k="Zostáva zaplatiť" v={d ? eur(d.kpi.due) : '…'} m={d ? `${d.kpi.due_count} ${plural(d.kpi.due_count, 'doklad neuhradený', 'doklady neuhradené', 'dokladov neuhradených')}` : ''} accent />
      </div>

      <div className="dash-mid">
        <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span className="card-title">Práca vs. diely</span><span className="card-meta">plná = práca · obrys = diely v NC</span>
          </div>
          <div className="bars" role="img" aria-label="Práca a diely po obdobiach">
            {(d?.bars ?? []).map((b, i) => (
              <div key={i} className="bar-pair" title={`${b.label}: práca ${eur(b.labor)}, diely ${eur(b.parts)}`}>
                <div className="bar-labor" style={{ height: `${(b.labor / maxBar) * 100}%` }} />
                <div className="bar-parts" style={{ height: `${(b.parts / maxBar) * 100}%`, visibility: b.parts ? 'visible' : 'hidden' }} />
              </div>
            ))}
          </div>
          <div className="bars-x">{(d?.bars ?? []).map((b, i) => <span key={i}>{b.label}</span>)}</div>
        </Blueprint>

        <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
          <span className="card-title">Mechanici</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            {(d?.mechanics ?? []).map(m => (
              <div key={m.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{m.name}</span><b>{hoursSk(m.hours)}</b></div>
                <div className="meter"><div style={{ width: `${(m.hours / maxMech) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <span className="card-meta" style={{ marginTop: 'auto' }}>Sadzba {rate} €/h · priemer {d ? hoursSk(d.avg_hours_per_order) : '…'} na zákazku</span>
        </Blueprint>
      </div>

      <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 0' }}>
          <span className="card-title">Otvorené zákazky</span><Link to="/admin/zakazky" style={{ fontSize: 13 }}>Všetky zákazky →</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th>#</th><th>Auto · zákazník</th><th>Mechanik</th><th>Čas</th><th>Nákup dielov · NC</th><th>Spolu</th><th>Stav</th><th></th></tr></thead>
            <tbody>
              {open.map(o => {
                const t = totalsOf(o, rate, now, billing)
                const hasTime = t.seconds > 0
                return (
                  <tr key={o.id} className="clickable" onClick={() => nav(`/admin/zakazky/${o.id}`)}>
                    <td>{o.number}</td>
                    <td><b>{carName(o.car)}</b> · {o.customer.name}</td>
                    <td>{o.mechanic ? firstName(o.mechanic.name) : '—'}</td>
                    <td className="num">{hasTime ? hm(t.seconds) : '—'}</td>
                    <td className="nowrap">{eur(t.parts_cost)}</td>
                    <td className="nowrap">{hasTime ? <b>{eur(t.grand)}</b> : '—'}</td>
                    <td><StatusTag status={o.status} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      {o.status === 'unpaid' && <Link to={`/admin/reporty/${o.id}`} style={{ fontSize: 13 }}>Pripomenúť</Link>}
                      {o.status === 'open' && <Link to={`/admin/reporty/${o.id}`} style={{ fontSize: 13 }}>Report</Link>}
                    </td>
                  </tr>
                )
              })}
              {!open.length && <tr><td colSpan={8} className="muted">Žiadne otvorené zákazky.</td></tr>}
            </tbody>
          </table>
        </div>
      </Blueprint>

      <NewJobDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={id => nav(`/admin/zakazky/${id}`)} />
    </div>
  )
}

function Kpi({ k, v, m, accent, extra }: { k: string; v: string; m: string; accent?: boolean; extra?: ReactNode }) {
  return (
    <Blueprint className="card" style={{ padding: '14px 16px', gap: 4 }}>
      <span className="card-kicker">{k}</span>
      <div className="kpi-v" style={accent ? { color: 'var(--color-accent-700)' } : undefined}>{v}</div>
      <span className="card-meta">{m || '\u00a0'}{extra}</span>
    </Blueprint>
  )
}
