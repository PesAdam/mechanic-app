import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { Car, FileText, LayoutGrid, Users, Wrench } from 'lucide-react'
import { totalsOf, useNow, useWorkshop } from '../store/workshop'
import { eur, hm, monthTitle, weekTitle } from '../lib/format'
import { mechShare, periods } from '../data/mock'
import { business } from '../data/business'
import Blueprint, { Corners } from '../components/Blueprint'
import StatusTag from '../components/StatusTag'
import NewJobDialog from '../components/NewJobDialog'

/** 1d · Web · Prehľad — parts spend, hours, margin and the open jobs. */
export default function Dashboard() {
  const { state, dispatch, mechName } = useWorkshop()
  const now = useNow(state.jobs.some(j => j.timer.running))
  const [period, setPeriod] = useState(0)
  const [newOpen, setNewOpen] = useState(false)
  const nav = useNavigate()

  const rate = state.hourlyRate
  const pd = periods[period]
  const today = new Date()
  const periodLabel = period === 0 ? weekTitle(today) : period === 1 ? monthTitle(today) : `Rok ${today.getFullYear()}`
  const open = state.jobs.filter(j => j.status !== 'done')
  const reportJob = state.jobs.find(j => j.status === 'unpaid') ?? state.jobs[0]
  const jobsInPeriod = Math.max(1, Math.round(pd.hours / 3.2))

  return (
    <div className="dash">
      <aside className="dash-side">
        <div className="hd" style={{ fontSize: 26, lineHeight: 1 }}>{business.name}</div>
        <nav className="dash-nav" aria-label="Sekcie">
          <NavLink to="/prehlad"><LayoutGrid size={16} strokeWidth={1.5} />Prehľad</NavLink>
          <NavLink to="/" end><Wrench size={16} strokeWidth={1.5} />Zákazky</NavLink>
          <span className="soon" title="Pripravuje sa"><Car size={16} strokeWidth={1.5} />Autá<span className="tag tag-neutral">čoskoro</span></span>
          <span className="soon" title="Pripravuje sa"><Users size={16} strokeWidth={1.5} />Zákazníci<span className="tag tag-neutral">čoskoro</span></span>
          {reportJob && <NavLink to={`/report/${reportJob.id}`}><FileText size={16} strokeWidth={1.5} />Reporty</NavLink>}
        </nav>
        <div className="dash-mechs">
          {state.mechanics.map(m => {
            const running = state.jobs.some(j => j.timer.running && j.timer.mechanicId === m.id)
            return (
              <div key={m.id}>
                <span>{mechName(m.id)}</span>
                <span style={running ? { color: 'var(--color-accent-700)' } : undefined}>{running ? '● beží' : 'voľno'}</span>
              </div>
            )
          })}
        </div>
      </aside>

      <main className="dash-main">
        <div className="dash-head">
          <div><div className="kicker">{periodLabel}</div><h1 style={{ fontSize: 36, margin: 0, lineHeight: 1.05 }}>Prehľad</h1></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="seg">
              {periods.map((p, i) => (
                <label key={p.label} className="seg-opt" style={{ minHeight: 36 }}>
                  <input type="radio" name="d-period" checked={i === period} onChange={() => setPeriod(i)} />{p.label}
                </label>
              ))}
            </div>
            <button className="btn btn-primary blueprint" style={{ minHeight: 36 }} onClick={() => setNewOpen(true)}><Corners />+ Nová zákazka</button>
          </div>
        </div>

        <div className="kpi-grid">
          <Kpi k="Diely nakúpené" v={eur(pd.parts)} m={`${pd.bars.filter(b => b[0]).length} aktívnych dní`} />
          <Kpi k="Hodiny pri autách" v={`${pd.hours} h`} m={`${(pd.hours * rate).toFixed(0)} € práca`} />
          <Kpi k="Fakturované" v={eur(pd.billed)} m={`marža ${Math.round((1 - pd.parts / pd.billed) * 100)} %`} />
          <Kpi k="Zostáva zaplatiť" v={eur(pd.due)} m={`${pd.dueN} ${pd.dueN === 1 ? 'doklad po splatnosti' : 'doklady neuhradené'}`} accent />
        </div>

        <div className="dash-mid">
          <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span className="card-title">Práca vs. diely</span><span className="card-meta">plná = práca · obrys = diely</span>
            </div>
            <div className="bars" role="img" aria-label="Práca a diely po dňoch">
              {pd.bars.map((b, i) => (
                <div key={i} className="bar-pair">
                  <div className="bar-labor" style={{ height: `${b[0]}%` }} />
                  <div className="bar-parts" style={{ height: `${b[1]}%`, visibility: b[1] ? 'visible' : 'hidden' }} />
                </div>
              ))}
            </div>
            <div className="bars-x">{pd.days.map((d, i) => <span key={i}>{d}</span>)}</div>
          </Blueprint>

          <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
            <span className="card-title">Mechanici</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {state.mechanics.map(m => {
                const share = mechShare[m.id] ?? 0
                return (
                  <div key={m.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{m.name}</span><b>{(pd.hours * share).toFixed(1)} h</b></div>
                    <div className="meter"><div style={{ width: `${share * 100}%` }} /></div>
                  </div>
                )
              })}
            </div>
            <span className="card-meta" style={{ marginTop: 'auto' }}>Sadzba {rate} €/h · priemer {(pd.hours / jobsInPeriod).toFixed(1)} h na zákazku</span>
          </Blueprint>
        </div>

        <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 0' }}>
            <span className="card-title">Otvorené zákazky</span><Link to="/" style={{ fontSize: 13 }}>Všetky zákazky →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ marginTop: 6 }}>
              <thead><tr><th>#</th><th>Auto · zákazník</th><th>Mechanik</th><th>Čas</th><th>Diely</th><th>Spolu</th><th>Stav</th><th></th></tr></thead>
              <tbody>
                {open.map(j => {
                  const t = totalsOf(j, rate, now)
                  const hasTime = t.totalSec > 0
                  return (
                    <tr key={j.id}>
                      <td>{j.id}</td>
                      <td><b>{j.car.make} {j.car.model}</b> · {j.customer.name}</td>
                      <td>{j.mechanicId ? mechName(j.mechanicId) : '—'}</td>
                      <td className="num">{hasTime ? hm(t.totalSec) : '—'}</td>
                      <td className="nowrap">{eur(t.partsSum)}</td>
                      <td className="nowrap">{hasTime ? <b>{eur(t.grand)}</b> : '—'}</td>
                      <td><StatusTag status={j.status} /></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {j.status === 'unpaid' && <Link to={`/report/${j.id}`} style={{ fontSize: 13 }}>Pripomenúť</Link>}
                        {j.status === 'open' && <Link to={`/report/${j.id}`} style={{ fontSize: 13 }}>Report</Link>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Blueprint>

        <div className="dash-foot no-print">
          <label htmlFor="rate">Sadzba</label>
          <input id="rate" type="number" className="input" style={{ width: 80, minHeight: 30 }} min={10} max={80} value={rate}
            onChange={e => { const v = Number(e.target.value); if (v >= 10 && v <= 80) dispatch({ type: 'setRate', rate: v }) }} />
          <span>€/h</span>
          <span>·</span>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { if (confirm('Obnoviť ukážkové dáta? Vaše zmeny sa stratia.')) dispatch({ type: 'reset' }) }}>Obnoviť ukážkové dáta</button>
        </div>
      </main>

      <NewJobDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={id => nav(`/zakazky/${id}`)} />
    </div>
  )
}

function Kpi({ k, v, m, accent }: { k: string; v: string; m: string; accent?: boolean }) {
  return (
    <Blueprint className="card" style={{ padding: '14px 16px', gap: 4 }}>
      <span className="card-kicker">{k}</span>
      <div className="kpi-v" style={accent ? { color: 'var(--color-accent-700)' } : undefined}>{v}</div>
      <span className="card-meta">{m}</span>
    </Blueprint>
  )
}
