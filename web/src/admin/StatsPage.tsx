import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useStats } from '../data/queries'
import { downloadCsv } from '../lib/csv'
import { dateOf, eur, hoursSk, skDate } from '../lib/format'
import { plural } from '../lib/text'
import type { Earnings, Period, StatsData } from '../lib/types'
import Blueprint from '../components/Blueprint'
import EarningsSplit from '../components/EarningsSplit'
import { InsightCharts, InsightTiles, Kpi } from './StatsInsights'

const PERIODS: [Period, string][] = [['week', 'Týždeň'], ['month', 'Mesiac'], ['year', 'Rok']]
const TREND: Record<Period, string> = { week: 'posledných 12 týždňov', month: 'posledných 12 mesiacov', year: 'posledných 5 rokov' }

/** Rows of the comparison table; `good` says which direction is good news (none for parts spend). */
const METRICS: { key: keyof Earnings; label: string; fmt: (n: number) => string; good?: 'up' }[] = [
  { key: 'labor', label: 'Zárobok z práce', fmt: eur, good: 'up' },
  { key: 'parts_margin', label: 'Zárobok z dielov', fmt: eur, good: 'up' },
  { key: 'earnings', label: 'Zárobok spolu', fmt: eur, good: 'up' },
  { key: 'billed', label: 'Zaplatené', fmt: eur, good: 'up' },
  { key: 'parts_cost', label: 'Nákup dielov', fmt: eur },
  { key: 'orders', label: 'Zákazky', fmt: n => String(n), good: 'up' },
  { key: 'hours', label: 'Hodiny pri autách', fmt: hoursSk },
  { key: 'per_hour', label: 'Zárobok na hodinu', fmt: n => `${eur(n)}/h`, good: 'up' },
]

/** Štatistika — how a week, month or year went: zárobok of the orders paid in it, next to the period before and a year earlier. */
export default function StatsPage() {
  const [period, setPeriod] = useState<Period>('month')
  // null = the period running now.
  const [date, setDate] = useState<string | null>(null)
  const stats = useStats(period, date)
  const nav = useNavigate()
  const s = stats.data?.period === period ? stats.data : undefined
  const c = s?.current
  const maxBar = Math.max(1, ...(s?.trend.flatMap(b => [b.earnings, b.parts_cost]) ?? []))

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><div className="kicker">{s?.label ?? '…'}</div><h1>Štatistika</h1></div>
        <div className="admin-actions">
          <div className="seg">
            {PERIODS.map(([p, label]) => (
              <label key={p} className="seg-opt" style={{ minHeight: 36 }}>
                <input type="radio" name="s-period" checked={p === period} onChange={() => { setPeriod(p); setDate(null) }} />{label}
              </label>
            ))}
          </div>
          <span style={{ display: 'inline-flex', gap: 4 }}>
            <button className="btn btn-secondary btn-icon" style={{ minHeight: 36 }} aria-label="Predchádzajúce obdobie" disabled={!s} onClick={() => s && setDate(s.previous_date)}><ChevronLeft size={16} strokeWidth={1.5} /></button>
            <button className="btn btn-secondary btn-icon" style={{ minHeight: 36 }} aria-label="Nasledujúce obdobie" disabled={!s?.next_date} onClick={() => s?.next_date && setDate(s.next_date)}><ChevronRight size={16} strokeWidth={1.5} /></button>
            {date && <button className="btn btn-ghost" style={{ minHeight: 36 }} onClick={() => setDate(null)}>Teraz</button>}
          </span>
          <button className="btn btn-secondary" style={{ minHeight: 36 }} disabled={!s?.orders.length} onClick={() => s && exportCsv(s)}
            title="Zákazky uzavreté v tomto období ako tabuľka pre Excel"><Download size={16} strokeWidth={1.5} />Export CSV</button>
        </div>
      </div>

      {stats.isError && !s && <Blueprint style={{ padding: 14 }}><div style={{ fontSize: 13 }}>Štatistiku sa nepodarilo načítať. <button className="btn btn-ghost" onClick={() => void stats.refetch()}>Skúsiť znova</button></div></Blueprint>}

      <EarningsSplit money={c} pending={s?.pending} changes={s && {
        labor: <Change cur={s.current.labor} prev={s.previous.labor} fmt={eur} good="up" />,
        parts: <Change cur={s.current.parts_margin} prev={s.previous.parts_margin} fmt={eur} good="up" />,
        total: <Change cur={s.current.earnings} prev={s.previous.earnings} fmt={eur} good="up" />,
      }} />

      <div className="kpi-grid kpi-grid-4">
        <Kpi k="Zaplatené" v={c ? eur(c.billed) : '…'} m={s && <Change cur={s.current.billed} prev={s.previous.billed} fmt={eur} good="up" />} />
        <Kpi k="Nákup dielov" v={c ? eur(c.parts_cost) : '…'} m={s && <Change cur={s.current.parts_cost} prev={s.previous.parts_cost} fmt={eur} />} />
        <Kpi k="Zákazky" v={c ? String(c.orders) : '…'} m={s && <Change cur={s.current.orders} prev={s.previous.orders} fmt={String} good="up" />} />
        <Kpi k="Zárobok na hodinu" v={c ? (c.per_hour === null ? '—' : `${eur(c.per_hour)}/h`) : '…'} m={c && `${hoursSk(c.hours)} pri autách`} />
      </div>

      {s?.insights && <InsightTiles i={s.insights} />}

      <div className="dash-mid">
        <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span className="card-title">Zárobok · {TREND[period]}</span><span className="card-meta">plná = zárobok · obrys = nákup dielov · klik vyberie obdobie</span>
          </div>
          <div className="bars" role="img" aria-label={`Zárobok a nákup dielov, ${TREND[period]}`}>
            {(s?.trend ?? []).map(b => {
              const picked = b.date === s?.start
              return (
                <button key={b.date} type="button" className="bar-pair bar-pick" style={{ opacity: picked ? 1 : 0.55 }} onClick={() => setDate(b.date)}
                  title={`${b.title}: zárobok ${eur(b.earnings)}, nákup dielov ${eur(b.parts_cost)}, fakturované ${eur(b.billed)} · ${b.orders} ${plural(b.orders, 'zákazka', 'zákazky', 'zákaziek')}`}>
                  <div className="bar-labor" style={{ height: `${(Math.max(0, b.earnings) / maxBar) * 100}%` }} />
                  <div className="bar-parts" style={{ height: `${(b.parts_cost / maxBar) * 100}%`, visibility: b.parts_cost ? 'visible' : 'hidden' }} />
                </button>
              )
            })}
          </div>
          <div className="bars-x">{(s?.trend ?? []).map(b => <span key={b.date} style={b.date === s?.start ? { fontWeight: 600, color: 'var(--color-text)' } : undefined}>{b.label}</span>)}</div>
        </Blueprint>

        <Blueprint className="card" style={{ padding: '16px 18px', gap: 8 }}>
          <span className="card-title">Z čoho je zárobok</span>
          {c && <>
            <div className="r-line" style={{ fontSize: 13 }}><span>Práca</span><span>{eur(c.labor)}</span></div>
            <div className="r-line" style={{ fontSize: 13 }}><span>Marža na dieloch</span><span>{eur(c.parts_margin)}</span></div>
            {c.discount !== 0 && <div className="r-line" style={{ fontSize: 13 }}><span>{c.discount > 0 ? 'Zľavy' : 'Navýšenia'}</span><span>{c.discount > 0 ? '−' : '+'}{eur(Math.abs(c.discount))}</span></div>}
            <div className="r-line" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 8, alignItems: 'baseline' }}>
              <span className="hd" style={{ fontSize: 16 }}>Zárobok</span><span className="hd" style={{ fontSize: 22, color: 'var(--color-accent-700)' }}>{eur(c.earnings)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderLeft: '2px solid var(--color-divider)', paddingLeft: 8, marginTop: 4 }}>
              <div className="r-line muted" style={{ fontSize: 12 }}><span>Zaplatené zákazníkmi</span><span>{eur(c.billed)}</span></div>
              <div className="r-line muted" style={{ fontSize: 12 }}><span>− nákup dielov</span><span>{eur(c.parts_cost)}</span></div>
              {c.parts_adjustment !== 0 && <div className="r-line muted" style={{ fontSize: 12 }}><span>{c.parts_adjustment < 0 ? '− odvod z marže' : '+ úprava marže'}</span><span>{eur(Math.abs(c.parts_adjustment))}</span></div>}
              <span className="muted" style={{ fontSize: 11 }}>Diely sa do zárobku rátajú len maržou – nákup zaplatíte dodávateľovi.</span>
            </div>
          </>}
        </Blueprint>
      </div>

      {s?.insights && <InsightCharts i={s.insights} period={period} />}

      <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
        <div style={{ padding: '12px 16px 0' }}><span className="card-title">Porovnanie</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th></th><th>{s?.label ?? '…'}</th><th>{s?.previous.label ?? 'Predtým'}</th><th>Zmena</th>{s?.year_earlier && <><th>{s.year_earlier.label}</th><th>Zmena</th></>}</tr></thead>
            <tbody>
              {s && METRICS.map(m => {
                const cur = s.current[m.key]
                const show = (v: number | null) => (v === null ? '—' : m.fmt(v))
                return (
                  <tr key={m.key}>
                    <td style={m.key === 'earnings' ? { fontWeight: 600 } : undefined}>{m.label}</td>
                    <td className="nowrap" style={m.key === 'earnings' ? { fontWeight: 600 } : undefined}>{show(cur)}</td>
                    <td className="nowrap muted">{show(s.previous[m.key])}</td>
                    <td className="nowrap"><Change cur={cur} prev={s.previous[m.key]} good={m.good} /></td>
                    {s.year_earlier && <><td className="nowrap muted">{show(s.year_earlier[m.key])}</td><td className="nowrap"><Change cur={cur} prev={s.year_earlier[m.key]} good={m.good} /></td></>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Blueprint>

      <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 16px 0', gap: 8 }}>
          <span className="card-title">Zaplatené zákazky</span>
          <span className="card-meta">{s ? `${s.orders.length} ${plural(s.orders.length, 'zákazka', 'zákazky', 'zákaziek')} · ${s.label}` : ''}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ marginTop: 6 }}>
            <thead><tr><th>#</th><th>Uhradené</th><th>Auto · zákazník</th><th>Hodiny</th><th>Práca</th><th>Diely fakt.</th><th>Nákup dielov</th><th>Zľava</th><th>Zaplatené</th><th>Zárobok</th></tr></thead>
            <tbody>
              {(s?.orders ?? []).map(o => (
                <tr key={o.id} className="clickable" onClick={() => nav(`/admin/zakazky/${o.id}`)}>
                  <td>{o.number}</td>
                  <td className="nowrap">{o.paid_at ? skDate(dateOf(o.paid_at)) : '—'}{o.closed_at && <div className="muted" style={{ fontSize: 11 }}>uzavretá {skDate(dateOf(o.closed_at))}</div>}</td>
                  <td><b>{o.car}</b> · {o.customer}<div className="muted" style={{ fontSize: 11 }}>{o.plate}</div></td>
                  <td className="nowrap">{hoursSk(o.hours)}</td>
                  <td className="nowrap">{eur(o.labor)}</td>
                  <td className="nowrap">{eur(o.parts_billed)}</td>
                  <td className="nowrap muted">{eur(o.parts_cost)}</td>
                  <td className="nowrap">{o.discount ? `${o.discount > 0 ? '−' : '+'}${eur(Math.abs(o.discount))}` : '—'}</td>
                  <td className="nowrap">{eur(o.billed)}</td>
                  <td className="nowrap"><b>{eur(o.earnings)}</b>{o.parts_adjustment !== 0 && <div className="muted" style={{ fontSize: 11 }}>{o.parts_adjustment < 0 ? `odvod −${eur(-o.parts_adjustment)}` : `úprava +${eur(o.parts_adjustment)}`}</div>}</td>
                </tr>
              ))}
              {s && !s.orders.length && <tr><td colSpan={10} className="muted">V tomto období nebola zaplatená žiadna zákazka.</td></tr>}
            </tbody>
          </table>
        </div>
      </Blueprint>
    </div>
  )
}

/** "▲ +12 % · predtým 65,00 €": change against an earlier figure, coloured only when the direction means something. */
function Change({ cur, prev, fmt, good }: { cur: number | null; prev: number | null; fmt?: (n: number) => string; good?: 'up' }) {
  if (cur === null || prev === null) return <span className="muted">—</span>
  const diff = cur - prev
  const pct = prev !== 0 ? Math.round((diff / Math.abs(prev)) * 100) : null
  const text = diff === 0 ? 'bez zmeny' : pct === null ? 'nové' : `${pct > 0 ? '+' : ''}${pct} %`
  const cls = !good || diff === 0 ? 'muted' : diff > 0 ? 'norm-ok' : 'norm-bad'
  return <span><span className={cls} style={{ fontWeight: 600 }}>{diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : ''}{text}</span>{fmt && <span className="muted"> · predtým {fmt(prev)}</span>}</span>
}

function exportCsv(s: StatsData) {
  downloadCsv(`statistika-${s.start}_${s.end}.csv`, [
    ['Číslo', 'Uzavreté', 'Uhradené', 'Auto', 'ŠPZ', 'Zákazník', 'Hodiny', 'Práca €', 'Diely fakturované €', 'Nákup dielov €', 'Úprava marže €', 'Zľava €', 'Zaplatené €', 'Zárobok €'],
    ...s.orders.map(o => [o.number, o.closed_at ? skDate(dateOf(o.closed_at)) : '', o.paid_at ? skDate(dateOf(o.paid_at)) : '', o.car, o.plate, o.customer, o.hours, o.labor, o.parts_billed, o.parts_cost, o.parts_adjustment, o.discount, o.billed, o.earnings]),
    ['Spolu', s.label, '', '', '', '', s.current.hours, s.current.labor, s.current.parts_billed, s.current.parts_cost, s.current.parts_adjustment, s.current.discount, s.current.billed, s.current.earnings],
  ])
}
