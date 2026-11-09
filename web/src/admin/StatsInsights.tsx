import type { ReactNode } from 'react'
import { Link } from 'react-router'
import Blueprint from '../components/Blueprint'
import { Bars, ChartCard, Columns, Heatmap, Key, Lines, TipBody, eurShort } from '../components/charts'
import { categoryLabel } from '../lib/categories'
import { eur, hm, hoursSk } from '../lib/format'
import { plural } from '../lib/text'
import type { Period, StatsBand, StatsInsights } from '../lib/types'

const LABOR = 'var(--viz-1)'
const PARTS = 'var(--viz-2)'
const PAST = 'var(--viz-past)'

const days = (n: number) => (Number.isInteger(n) ? `${n} ${plural(n, 'deň', 'dni', 'dní')}` : `${n.toFixed(1).replace('.', ',')} dňa`)
const orders = (n: number) => `${n} ${plural(n, 'zákazka', 'zákazky', 'zákaziek')}`
const jobs = (n: number) => `${n} ${plural(n, 'úkon', 'úkony', 'úkonov')}`
const share = (part: number, whole: number) => `${whole > 0 ? Math.round((part / whole) * 100) : 0} %`
const jobCategory = (key: string) => (key === 'bez' ? 'Bez úkonov (podľa času)' : categoryLabel(key))

export function Kpi({ k, v, m }: { k: string; v: string; m?: ReactNode }) {
  return (
    <Blueprint className="card" style={{ padding: '14px 16px', gap: 4 }}>
      <span className="card-kicker">{k}</span>
      <div className="kpi-v">{v}</div>
      <span className="card-meta">{m || ' '}</span>
    </Blueprint>
  )
}

/** Averages, the biggest order, norm efficiency, customers, payment speed, what is owed, hours and portal requests. */
export function InsightTiles({ i }: { i: StatsInsights }) {
  const { averages: a, jobs: j, payment: p, owed: o, work: w, requests: r, customers: c } = i
  return (
    <>
      <div className="kpi-grid kpi-grid-4">
        <Kpi k="Priemerná zákazka" v={a.order_billed === null ? '—' : eur(a.order_billed)}
          m={a.order_earnings !== null && a.median_billed !== null && `zárobok ${eur(a.order_earnings)} · medián ${eur(a.median_billed)}`} />
        <Kpi k="Najväčšia zákazka" v={a.biggest ? eur(a.biggest.billed) : '—'}
          m={a.biggest && <Link to={`/admin/zakazky/${a.biggest.id}`}>#{a.biggest.number} · {a.biggest.car || a.biggest.customer}</Link>} />
        <Kpi k="Rýchlosť podľa noriem" v={j.efficiency === null ? '—' : `${j.efficiency} %`}
          m={j.efficiency !== null && <><span className={j.efficiency >= 100 ? 'norm-ok' : 'norm-bad'} style={{ fontWeight: 600 }}>{j.efficiency >= 100 ? 'rýchlejšie ako norma' : 'pomalšie ako norma'}</span> · norma {hoursSk(j.norm_hours)}, reálne {hoursSk(j.actual_hours)}</>} />
        <Kpi k="Zákazníci" v={String(c.count)} m={c.count > 0 && `${c.new} ${plural(c.new, 'nový', 'noví', 'nových')} · ${c.returning} ${plural(c.returning, 'vracajúci sa', 'vracajúci sa', 'vracajúcich sa')}`} />
      </div>
      <div className="kpi-grid kpi-grid-4">
        <Kpi k="Zaplatia za" v={p.avg_days === null ? '—' : days(p.avg_days)} m={p.turnaround_days !== null ? `po uzavretí · auto v dielni ${days(p.turnaround_days)}` : 'po uzavretí'} />
        <Kpi k="Čaká na platbu teraz" v={eur(o.total)} m={o.count ? `${orders(o.count)} · najstaršia ${days(o.oldest_days ?? 0)}` : 'nikto nedlží'} />
        <Kpi k="Odpracované pri autách" v={hoursSk(w.hours)} m={w.mechanics.length > 0 && `${w.mechanics.length} ${plural(w.mechanics.length, 'mechanik', 'mechanici', 'mechanikov')} so stopkami`} />
        <Kpi k="Požiadavky z portálu" v={String(r.count)} m={r.count > 0 && `${r.accepted} ${plural(r.accepted, 'prijatá', 'prijaté', 'prijatých')} · ${r.rejected} ${plural(r.rejected, 'zamietnutá', 'zamietnuté', 'zamietnutých')}${r.waiting ? ` · ${r.waiting} čaká` : ''}`} />
      </div>
    </>
  )
}

/** Single-series columns of ordered bands with the count on each cap. */
function BandColumns({ bands, ariaLabel }: { bands: StatsBand[]; ariaLabel: string }) {
  return <Columns items={bands} series={[{ label: 'Zákazky', color: LABOR, value: b => b.count }]} label={b => b.label} labelAll axis={false} height={130}
    fmt={n => String(Math.round(n))} ariaLabel={ariaLabel} tip={b => <TipBody title={b.label} rows={[{ label: plural(b.count, 'zákazka', 'zákazky', 'zákaziek'), value: String(b.count) }]} />} />
}

const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <table className="table">
    <thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, k) => <tr key={k}>{r.map((c, n) => <td key={n} className="nowrap">{c}</td>)}</tr>)}</tbody>
  </table>
)

/** Every chart of the period below the headline figures. */
export function InsightCharts({ i, period }: { i: StatsInsights; period: Period }) {
  const days31 = period === 'month'
  const noPaid = i.breakdown.every(b => b.orders === 0) && 'V tomto období nebola zaplatená žiadna zákazka.'
  const laborTotal = i.jobs.categories.reduce((a, c) => a + c.labor, 0)
  const workTotal = i.work.hours
  const yearEmpty = [...i.year.current, ...i.year.previous].every(v => !v)

  return (
    <>
      <ChartCard title={period === 'year' ? 'Zárobok po mesiacoch' : 'Zárobok po dňoch'} meta="podľa dňa úhrady · práca a marža na dieloch" empty={noPaid}
        legend={<><Key color={LABOR} label="Práca" /><Key color={PARTS} label="Marža na dieloch" /></>}
        table={<Table head={[period === 'year' ? 'Mesiac' : 'Deň', 'Práca', 'Marža na dieloch', 'Zárobok', 'Zákazky']}
          rows={i.breakdown.filter(b => b.orders > 0).map(b => [b.title, eur(b.labor), eur(b.parts_margin), <b key="e">{eur(b.earnings)}</b>, b.orders])} />}>
        <Columns items={i.breakdown} label={b => b.label} fmt={eurShort} ariaLabel="Zárobok z práce a z dielov po dňoch obdobia"
          showLabel={days31 ? (_, k) => k === 0 || (k + 1) % 5 === 0 : undefined}
          series={[{ label: 'Práca', color: LABOR, value: b => b.labor }, { label: 'Marža na dieloch', color: PARTS, value: b => b.parts_margin }]}
          tip={b => <TipBody title={`${b.title} · ${orders(b.orders)}`} rows={[
            { label: 'zárobok', value: eur(b.earnings) },
            { label: 'práca', value: eur(b.labor), color: LABOR },
            { label: 'marža na dieloch', value: eur(b.parts_margin), color: PARTS },
          ]} />} />
      </ChartCard>

      <div className="stats-grid">
        <ChartCard title="Práca podľa druhu úkonov" meta="zárobok z práce zaplatených zákaziek" empty={!i.jobs.categories.length && 'Žiadna zaplatená práca.'}>
          <Bars items={i.jobs.categories} label={c => jobCategory(c.key)} value={c => c.labor} fmt={eur} sub={c => jobs(c.jobs)}
            tip={c => <TipBody title={jobCategory(c.key)} rows={[{ label: 'z celej práce', value: share(c.labor, laborTotal) }, { label: 'zárobok', value: eur(c.labor) }]} />} />
        </ChartCard>
        <ChartCard title="Najčastejšie úkony" meta="koľkokrát · priemerný čas oproti norme" empty={!i.jobs.top.length && 'Zaplatené zákazky nemali úkony.'}>
          <Bars items={i.jobs.top} label={t => t.name} value={t => t.count} fmt={n => `${n}×`}
            sub={t => <>{t.avg_minutes !== null && <span className={t.avg_minutes <= t.norm_minutes ? 'norm-ok' : 'norm-bad'}>Ø {hm(t.avg_minutes * 60)}</span>} · norma {hm(t.norm_minutes * 60)}</>}
            tip={t => <TipBody title={t.name} rows={[
              { label: 'zárobok z práce', value: eur(t.labor) },
              { label: 'priemerne pri aute', value: t.avg_minutes === null ? '—' : hm(t.avg_minutes * 60) },
              { label: 'norma', value: hm(t.norm_minutes * 60) },
            ]} />} />
        </ChartCard>
      </div>

      <div className="stats-grid">
        <ChartCard title="Značky áut" meta="zárobok podľa značky" empty={!i.makes.length && 'Žiadne zaplatené zákazky.'}>
          <Bars items={i.makes} label={m => m.make} value={m => m.earnings} fmt={eur} sub={m => orders(m.orders)} />
        </ChartCard>
        <ChartCard title="Najlepší zákazníci" meta="podľa zárobku" empty={!i.customers.count && 'Žiadni zákazníci s platbou.'}
          legend={<><Key color={LABOR} label={`Vracajúci sa ${i.customers.returning}`} /><Key color={PARTS} label={`Noví ${i.customers.new}`} /></>}>
          <div className="viz-split" role="img" aria-label={`${i.customers.returning} vracajúcich sa a ${i.customers.new} nových zákazníkov`}>
            {i.customers.returning > 0 && <span style={{ flexGrow: i.customers.returning, background: LABOR }} />}
            {i.customers.new > 0 && <span style={{ flexGrow: i.customers.new, background: PARTS }} />}
          </div>
          <Bars items={i.customers.top} label={c => c.name} value={c => c.earnings} fmt={eur} sub={c => `${orders(c.orders)} · zaplatil ${eur(c.billed)}`} />
        </ChartCard>
      </div>

      <div className="stats-grid">
        <ChartCard title="Kedy sa pracuje" meta={`stopky podľa dňa a hodiny · spolu ${hoursSk(workTotal)}`} empty={workTotal === 0 && 'V tomto období nikto nespúšťal stopky.'}
          table={<Table head={['Deň', 'Odpracované', 'Najviac o']} rows={i.work.heatmap.rows.map((r, k) => {
            const best = r.cells.indexOf(Math.max(...r.cells))
            return [r.label, hoursSk(i.work.weekdays[k]?.hours ?? 0), r.cells[best] > 0 ? `${i.work.heatmap.hours[best]}:00` : '—']
          })} />}>
          <Heatmap cols={i.work.heatmap.hours.map(String)} showCol={k => k % 2 === 0}
            rows={i.work.heatmap.rows.map((r, k) => ({ ...r, total: hoursSk(i.work.weekdays[k]?.hours ?? 0) }))}
            cellLabel={(d, h, v) => `${d} ${h}:00: ${hoursSk(v)}`}
            tip={(d, h, v) => <TipBody title={`${d} · ${h}:00–${Number(h) + 1}:00`} rows={[{ label: 'odpracované', value: hm(Math.round(v * 3600)) }]} />} />
        </ChartCard>
        <ChartCard title="Mechanici" meta="odpracované hodiny so stopkami" empty={!i.work.mechanics.length && 'Bez záznamov času.'}>
          <Bars items={i.work.mechanics} label={m => m.name} value={m => m.hours} fmt={hoursSk} sub={m => `${orders(m.orders)} · ${share(m.hours, workTotal)} času`} />
        </ChartCard>
      </div>

      <div className="stats-grid">
        <ChartCard title="Veľkosť zákaziek" meta="koľko zákazník zaplatil" empty={noPaid}>
          <BandColumns bands={i.sizes} ariaLabel="Počet zákaziek podľa zaplatenej sumy" />
        </ChartCard>
        <ChartCard title="Ako rýchlo platia" meta={i.payment.avg_days === null ? 'od uzavretia po úhradu' : `od uzavretia po úhradu · priemerne ${days(i.payment.avg_days)}`} empty={noPaid}>
          <BandColumns bands={i.payment.bands} ariaLabel="Počet zákaziek podľa dní od uzavretia po úhradu" />
        </ChartCard>
      </div>

      <div className="stats-grid stats-grid-wide">
        <ChartCard title={`Zárobok od začiatku roka ${i.year.label}`} meta={`spočítaný mesiac po mesiaci, oproti roku ${i.year.previous_label}`} empty={yearEmpty && 'Za tento ani minulý rok zatiaľ nič zaplatené.'}
          legend={<><Key line color={LABOR} label={i.year.label} /><Key line color={PAST} label={i.year.previous_label} /></>}
          table={<Table head={['Mesiac', i.year.label, i.year.previous_label]} rows={i.year.months.map((m, k) => [m, i.year.current[k] === null ? '—' : eur(i.year.current[k] ?? 0), eur(i.year.previous[k])])} />}>
          <Lines labels={i.year.months} fmt={eurShort} ariaLabel={`Zárobok od začiatku roka ${i.year.label} a ${i.year.previous_label}`}
            series={[{ label: i.year.label, color: LABOR, values: i.year.current }, { label: i.year.previous_label, color: PAST, values: i.year.previous }]} />
        </ChartCard>
        <ChartCard title="Čaká na platbu" meta={<>teraz, podľa dní od uzavretia · <Link to="/admin/zakazky">Zákazky →</Link></>} empty={!i.owed.count && 'Všetko je zaplatené.'}>
          <Bars items={i.owed.bands} label={b => b.label} value={b => b.total} fmt={eur} sub={b => orders(b.count)} />
        </ChartCard>
      </div>
    </>
  )
}
