import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'
import { entrySeconds, firstName, partPrice, totalsOf, carName } from '../lib/calc'
import { addDays, dateOf, eur, hhmm, hm, hoursSk, km, shortVin, skDate } from '../lib/format'
import type { CodeStatus, Order, Settings } from '../lib/types'
import Blueprint from '../components/Blueprint'
import ImageSlot from '../components/ImageSlot'
import PayBySquare from '../components/PayBySquare'

const CODE_TAG: Record<CodeStatus, [string, string]> = { fixed: ['Odstránené', 'tag-accent'], watch: ['Sledovať', 'tag-neutral'], open: ['Otvorené', 'tag-outline'] }
const DUE_DAYS = 14

interface Props { order: Order; settings: Settings; now: number; tools?: ReactNode }

/** 1e · Report pre zákazníka — photos, diagnostics, labor, parts, invoice + PAY by square. */
export default function ReportView({ order, settings, now, tools }: Props) {
  const b = settings.business
  const rate = settings.hourly_rate
  const t = totalsOf(order, rate, now, settings.labor_billing)
  const byNorm = t.labor_billing === 'norm'
  const day = dateOf(order.closed_at ?? order.received_at ?? new Date(now).toISOString())
  const year = day.slice(0, 4)
  const docNo = `${year}-${order.number}`
  // Variabilný symbol zatiaľ vypnutý:
  // const vs = `${year}${order.number}`
  const range = timeRange(order, now)
  const photos = order.photos
  const codes = order.diagnostic?.codes ?? []

  return (
    <div className="report-wrap">
      {tools && <div className="report-tools no-print">{tools}</div>}

      <article className="report">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="hd" style={{ fontSize: 40, lineHeight: 0.9 }}>{b.name}</div>
            <div className="muted" style={{ marginTop: 8, lineHeight: 1.4 }}>
              {[b.owner, [b.street, b.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}<br />{[b.phone, b.email].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="kicker-muted" style={{ letterSpacing: '.12em' }}>Servisný report</div>
            <div className="hd" style={{ fontSize: 28, lineHeight: 1 }}>#{order.number}</div>
            <div className="muted" style={{ marginTop: 6 }}>{skDate(day)}{range ? ` · ${range}` : ''}</div>
            <div style={{ marginTop: 8 }}><a className="tag tag-outline" href={`/r/${order.public_token}`} style={{ textDecoration: 'none' }}>Online verzia: {window.location.host}/r/{order.public_token.slice(0, 8)}…</a></div>
          </div>
        </header>

        <div className="r2">
          <Blueprint className="r-box">
            <div className="r-k">Zákazník</div>
            <div className="hd" style={{ fontSize: 20 }}>{order.customer.name || '—'}</div>
            <div className="muted">{order.customer.phone || '—'}</div>
          </Blueprint>
          <Blueprint className="r-box">
            <div className="r-k">Vozidlo</div>
            <div className="hd" style={{ fontSize: 20 }}>{carName(order.car)}</div>
            <div className="muted">{order.car.plate} · VIN {shortVin(order.car.vin)} · {km(order.car.km)}</div>
          </Blueprint>
        </div>

        <section>
          <h3><span>01</span>Fotodokumentácia</h3>
          <div className="r-photos">
            {Array.from({ length: Math.max(5, photos.length) }, (_, i) => {
              const p = photos[i]
              return <ImageSlot key={p?.id ?? `empty-${i}`} src={p?.url} label={p?.label ?? (i === 0 ? 'Auto zákazníka' : 'Fotka')} />
            })}
          </div>
        </section>

        <section>
          <h3><span>02</span>Výpis z diagnostiky</h3>
          {codes.length ? (
            <table className="table" style={{ fontSize: 13 }}>
              <thead><tr><th>Kód</th><th>Popis</th><th>Riadiaca jednotka</th><th>Stav</th></tr></thead>
              <tbody>
                {codes.map(c => {
                  const [label, cls] = CODE_TAG[c.status]
                  return (
                    <tr key={c.id}>
                      <td className="num"><b>{c.code}</b></td><td>{c.description || '—'}</td><td>{c.unit || '—'}</td><td><span className={`tag ${cls}`}>{label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <div className="muted">Bez chybových kódov.</div>}
          {order.diagnostic && (
            <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <FileText size={14} strokeWidth={1.5} />
              Príloha: kompletný protokol {order.diagnostic.file_name}{order.diagnostic.pages ? ` (${order.diagnostic.pages} strán)` : ''}
            </div>
          )}
        </section>

        <div className="r2" style={{ gap: 28 }}>
          <section>
            <h3><span>03</span>Vykonaná práca</h3>
            <table className="table" style={{ fontSize: 13 }}>
              <tbody>
                {byNorm
                  ? order.operations.map(op => (
                    <tr key={op.id}><td>{op.name}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{hm(op.norm_minutes * 60)}</td></tr>
                  ))
                  : order.work_entries.map(e => (
                    <tr key={e.id}>
                      <td>{e.note || `Práca · ${firstName(e.user.name)}`}{!e.ended_at ? ' (prebieha)' : ''}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{hm(entrySeconds(e, now))}</td>
                    </tr>
                  ))}
                {!byNorm && !order.work_entries.length && <tr><td className="muted" colSpan={2}>Bez zapísanej práce.</td></tr>}
                <tr><td><b>Spolu práca</b> · {byNorm ? `${hoursSk(t.norm_seconds / 3600)} × ` : ''}{rate} €/h</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><b>{eur(t.labor)}</b></td></tr>
              </tbody>
            </table>
          </section>
          <section>
            <h3><span>04</span>Použité diely</h3>
            <table className="table" style={{ fontSize: 13 }}>
              <tbody>
                {order.parts.filter(p => p.used).map(p => (
                  <tr key={p.id}><td>{p.name}{p.meta && <div className="muted" style={{ fontSize: 11 }}>{p.meta}</div>}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{eur(partPrice(p, order.parts_pricing))}</td></tr>
                ))}
                {!order.parts.some(p => p.used) && <tr><td className="muted" colSpan={2}>Bez účtovaných dielov.</td></tr>}
                <tr><td><b>Spolu diely</b></td><td style={{ textAlign: 'right' }}><b>{eur(t.parts)}</b></td></tr>
              </tbody>
            </table>
          </section>
        </div>

        <Blueprint className="r-invoice">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="r-k">Doklad č. {docNo} · {b.vat_payer ? 'platiteľ DPH' : 'neplatiteľ DPH'}</div>
            <div className="r-line"><span>Práca</span><span>{eur(t.labor)}</span></div>
            <div className="r-line"><span>Diely</span><span>{eur(t.parts)}</span></div>
            <div className="r-line" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 8, alignItems: 'baseline' }}>
              <span className="hd" style={{ fontSize: 18 }}>K úhrade</span>
              <span className="hd" style={{ fontSize: 34, lineHeight: 1 }}>{eur(t.grand)}</span>
            </div>
            {b.iban && <div style={{ color: 'var(--color-neutral-800)', lineHeight: 1.5, marginTop: 4 }}>IBAN {b.iban}{/* · VS {vs} */}</div>}
          </div>
          <PayBySquare iban={b.iban} amount={t.grand} /* vs={vs} */ beneficiary={b.owner || b.name} due={addDays(day, DUE_DAYS)} note={`Doklad ${docNo}`} />
        </Blueprint>
      </article>
    </div>
  )
}

/** "09:40 – 15:05": first record of the day to the last one (or now while running). */
function timeRange(order: Order, now: number): string | null {
  const starts: number[] = []
  const ends: number[] = []
  if (order.received_at) starts.push(Date.parse(order.received_at))
  if (order.diagnostic) { const x = Date.parse(order.diagnostic.imported_at); starts.push(x); ends.push(x) }
  for (const p of order.photos) { const x = Date.parse(p.taken_at); starts.push(x); ends.push(x) }
  for (const e of order.work_entries) { starts.push(Date.parse(e.started_at)); ends.push(e.ended_at ? Date.parse(e.ended_at) : now) }
  if (!starts.length) return null
  const start = Math.min(...starts)
  const end = Math.max(start, ...ends)
  return `${hhmm(new Date(start))} – ${hhmm(new Date(end))}`
}
