import { Link, useParams } from 'react-router'
import { ChevronLeft, FileText, Printer } from 'lucide-react'
import { elapsedOf, totalsOf, useNow, useWorkshop } from '../store/workshop'
import { addDays, eur, fromMin, hhmm, hm, km, shortVin, skDate, toMin } from '../lib/format'
import type { CodeStatus, Job } from '../lib/types'
import { business } from '../data/business'
import Blueprint, { Corners } from '../components/Blueprint'
import ImageSlot from '../components/ImageSlot'
import NotFound from '../components/NotFound'
import PayBySquare from '../components/PayBySquare'

const CODE_TAG: Record<CodeStatus, [string, string]> = { fixed: ['Odstránené', 'tag-accent'], watch: ['Sledovať', 'tag-neutral'], open: ['Otvorené', 'tag-outline'] }

/** 1e · Report pre zákazníka — photos, diagnostics, labor, parts, invoice + PAY by square. */
export default function Report() {
  const { id } = useParams()
  const { state, mechName } = useWorkshop()
  const job = state.jobs.find(j => j.id === id)
  const now = useNow(!!job?.timer.running)
  if (!job) return <NotFound what="Report" />

  const rate = state.hourlyRate
  const t = totalsOf(job, rate, now)
  const year = job.date.slice(0, 4)
  const docNo = `${year}-${job.id}`
  const vs = `${year}${job.id}`
  const range = timeRange(job, now)
  const photos = job.photos
  const session = elapsedOf(job, now)
  const codes = job.diagnostic?.codes ?? []

  return (
    <div className="report-wrap">
      <div className="report-tools no-print">
        <Link to={`/zakazky/${job.id}`} className="btn btn-secondary"><ChevronLeft size={16} strokeWidth={1.5} />Zákazka</Link>
        <span className="muted" style={{ fontSize: 13 }}>Servisný report #{job.id}</span>
        <button className="btn btn-primary blueprint" onClick={() => window.print()}><Corners /><Printer size={16} strokeWidth={1.5} />Tlačiť / PDF</button>
      </div>

      <article className="report">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="hd" style={{ fontSize: 40, lineHeight: 0.9 }}>{business.name}</div>
            <div className="muted" style={{ marginTop: 8, lineHeight: 1.4 }}>
              {business.owner} · {business.street}, {business.city}<br />{business.phone} · {business.email}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="kicker-muted" style={{ letterSpacing: '.12em' }}>Servisný report</div>
            <div className="hd" style={{ fontSize: 28, lineHeight: 1 }}>#{job.id}</div>
            <div className="muted" style={{ marginTop: 6 }}>{skDate(job.date)}{range ? ` · ${range}` : ''}</div>
            <div style={{ marginTop: 8 }}><span className="tag tag-outline">Online verzia: {business.reportHost}/{job.id}</span></div>
          </div>
        </header>

        <div className="r2">
          <Blueprint className="r-box">
            <div className="r-k">Zákazník</div>
            <div className="hd" style={{ fontSize: 20 }}>{job.customer.name || '—'}</div>
            <div className="muted">{job.customer.phone || '—'}</div>
          </Blueprint>
          <Blueprint className="r-box">
            <div className="r-k">Vozidlo</div>
            <div className="hd" style={{ fontSize: 20 }}>{job.car.make} {job.car.model}</div>
            <div className="muted">{job.car.plate} · VIN {shortVin(job.car.vin)} · {km(job.car.km)}</div>
          </Blueprint>
        </div>

        <section>
          <h3><span>01</span>Fotodokumentácia</h3>
          <div className="r-photos">
            {Array.from({ length: 5 }, (_, i) => {
              const p = photos[i]
              return <ImageSlot key={p?.id ?? i} src={p?.src} label={p?.label ?? (i === 0 ? 'Auto zákazníka' : 'Fotka')} />
            })}
          </div>
          {photos.length > 5 && <div className="muted" style={{ marginTop: 8 }}>+ {photos.length - 5} ďalších fotiek v online verzii</div>}
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
                    <tr key={c.code}>
                      <td className="num"><b>{c.code}</b></td><td>{c.desc || '—'}</td><td>{c.unit || '—'}</td><td><span className={`tag ${cls}`}>{label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <div className="muted">Bez chybových kódov.</div>}
          {job.diagnostic && (
            <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <FileText size={14} strokeWidth={1.5} />
              Príloha: kompletný protokol {job.diagnostic.file}{job.diagnostic.pages ? ` (${job.diagnostic.pages} strán)` : ''}
            </div>
          )}
        </section>

        <div className="r2" style={{ gap: 28 }}>
          <section>
            <h3><span>03</span>Vykonaná práca</h3>
            <table className="table" style={{ fontSize: 13 }}>
              <tbody>
                {job.work.map(w => (
                  <tr key={w.id}><td>{w.note || `Práca · ${mechName(w.mechanicId)}`}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{hm(w.seconds)}</td></tr>
                ))}
                {session > 0 && (
                  <tr><td>{job.timer.note || `Práca · ${mechName(job.timer.mechanicId)}`}{job.timer.running ? ' (prebieha)' : ''}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{hm(session)}</td></tr>
                )}
                {!job.work.length && session === 0 && <tr><td className="muted" colSpan={2}>Bez zapísanej práce.</td></tr>}
                <tr><td><b>Spolu práca</b> · {rate} €/h</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><b>{eur(t.labor)}</b></td></tr>
              </tbody>
            </table>
          </section>
          <section>
            <h3><span>04</span>Použité diely</h3>
            <table className="table" style={{ fontSize: 13 }}>
              <tbody>
                {job.parts.filter(p => p.used).map(p => (
                  <tr key={p.id}><td>{p.name}<div className="muted" style={{ fontSize: 11 }}>{p.meta}</div></td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{eur(p.price)}</td></tr>
                ))}
                {!job.parts.some(p => p.used) && <tr><td className="muted" colSpan={2}>Bez účtovaných dielov.</td></tr>}
                <tr><td><b>Spolu diely</b></td><td style={{ textAlign: 'right' }}><b>{eur(t.partsSum)}</b></td></tr>
              </tbody>
            </table>
          </section>
        </div>

        <Blueprint className="r-invoice">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="r-k">Doklad č. {docNo} · {business.vatPayer ? 'platiteľ DPH' : 'neplatiteľ DPH'}</div>
            <div className="r-line"><span>Práca</span><span>{eur(t.labor)}</span></div>
            <div className="r-line"><span>Diely</span><span>{eur(t.partsSum)}</span></div>
            <div className="r-line" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 8, alignItems: 'baseline' }}>
              <span className="hd" style={{ fontSize: 18 }}>K úhrade</span>
              <span className="hd" style={{ fontSize: 34, lineHeight: 1 }}>{eur(t.grand)}</span>
            </div>
            <div style={{ color: 'var(--color-neutral-800)', lineHeight: 1.5, marginTop: 4 }}>
              IBAN {business.iban} · VS {vs}<br />
              Splatnosť {skDate(addDays(job.date, business.dueDays))} · možná aj platba hotovosťou alebo kartou v dielni
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 'auto' }}>
              {business.owner}, Hôrky · IČO {business.ico} · {business.vatPayer ? 'som platiteľom DPH' : 'nie som platiteľom DPH'}. Doklad vystavený elektronicky.
            </div>
          </div>
          <PayBySquare />
        </Blueprint>
      </article>
    </div>
  )
}

/** "09:40 – 15:05": first record of the day to the last one (or now while running). */
function timeRange(job: Job, at: number): string | null {
  const starts: number[] = []
  const ends: number[] = []
  if (job.receivedAt) starts.push(toMin(job.receivedAt))
  if (job.diagnostic?.importedAt) { starts.push(toMin(job.diagnostic.importedAt)); ends.push(toMin(job.diagnostic.importedAt)) }
  for (const p of job.photos) if (p.takenAt) { starts.push(toMin(p.takenAt)); ends.push(toMin(p.takenAt)) }
  for (const w of job.work) { starts.push(toMin(w.start)); ends.push(toMin(w.start) + Math.round(w.seconds / 60)) }
  if (job.timer.sessionStart) {
    starts.push(toMin(job.timer.sessionStart))
    ends.push(job.timer.running ? toMin(hhmm(new Date(at))) : toMin(job.timer.sessionStart) + Math.round(elapsedOf(job, at) / 60))
  }
  if (!starts.length) return null
  const start = Math.min(...starts)
  const end = Math.max(start, ...ends)
  return `${fromMin(start)} – ${fromMin(end)}`
}
