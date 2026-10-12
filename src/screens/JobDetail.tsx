import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Camera, Check, ChevronLeft, FileText, Pause, Play, Plus } from 'lucide-react'
import { totalsOf, useNow, useWorkshop } from '../store/workshop'
import { eur, hm, hms, km } from '../lib/format'
import { lowerFirst, plural } from '../lib/text'
import { fileToDataUrl } from '../lib/image'
import type { Part, PhotoStage } from '../lib/types'
import { business } from '../data/business'
import Blueprint, { Corners } from '../components/Blueprint'
import ImageSlot from '../components/ImageSlot'
import StatusTag from '../components/StatusTag'
import NotFound from '../components/NotFound'
import JobViewSwitch from '../components/JobViewSwitch'
import { AddCodeDialog, AddPartDialog, ManualTimeDialog } from '../components/JobDialogs'

const STAGE_LABEL: Record<PhotoStage, string> = { pred: 'Pred', pocas: 'Počas', po: 'Po' }

/** 1a · Zákazka — the stopwatch in the middle, parts and photos below. */
export default function JobDetail() {
  const { id } = useParams()
  const { state, dispatch, mechName } = useWorkshop()
  const job = state.jobs.find(j => j.id === id)
  const nav = useNavigate()
  const now = useNow(!!job?.timer.running)
  const [manualOpen, setManualOpen] = useState(false)
  const [partOpen, setPartOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const diagInput = useRef<HTMLInputElement>(null)

  if (!job) return <NotFound />

  const t = totalsOf(job, state.hourlyRate, now)
  const closed = job.status === 'unpaid' || job.status === 'done'
  const who = mechName(job.timer.mechanicId || job.mechanicId || state.currentMechanicId)
  const codes = job.diagnostic?.codes ?? []

  const nextStage = (): PhotoStage => (closed ? 'po' : job.work.length || t.elapsed > 0 ? 'pocas' : 'pred')
  const addPhoto = (src: string) => {
    const stage = nextStage()
    const n = job.photos.filter(p => p.stage === stage).length + 1
    dispatch({ type: 'addPhoto', jobId: job.id, photo: { label: `${STAGE_LABEL[stage]} ${n}`, stage, src } })
  }

  return (
    <div className="phone">
      <div className="screen">
        <div className="screen-head">
          <Link to="/" className="back" aria-label="Späť do dielne">
            <ChevronLeft size={20} strokeWidth={1.5} />
            <span className="hd" style={{ fontSize: 18 }}>{business.name}</span>
          </Link>
          <StatusTag status={job.status} />
        </div>

        <JobViewSwitch id={job.id} view="detail" />

        <div>
          <div className="kicker">Zákazka #{job.id} · {job.customer.name}</div>
          <h2 style={{ fontSize: 28, margin: '2px 0 0' }}>{job.car.make} {job.car.model}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{job.car.plate} · {km(job.car.km)} · {lowerFirst(job.summary)}</div>
        </div>

        <Blueprint style={{ padding: '22px 16px 18px', textAlign: 'center' }}>
          <div className="kicker-muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <i className={job.timer.running ? 'dot live' : 'dot'} />{closed ? 'Uzavreté' : 'Dnes'} · {who}
          </div>
          <div className="hd num" style={{ fontSize: 64, lineHeight: 1, letterSpacing: '-.02em', margin: '6px 0 4px' }}>{hms(t.elapsed)}</div>
          <div className="muted" style={{ fontSize: 12 }}>Celkom na aute {hm(t.totalSec)} · {eur(t.labor)}</div>
          {!closed && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {job.timer.running ? (
                <button className="btn btn-secondary" style={{ flex: 1, minHeight: 44 }} onClick={() => dispatch({ type: 'toggleTimer', jobId: job.id })}>
                  <Pause size={16} strokeWidth={1.5} />Pauza
                </button>
              ) : (
                <button className="btn btn-primary blueprint" style={{ flex: 1, minHeight: 44 }} onClick={() => dispatch({ type: 'toggleTimer', jobId: job.id })}>
                  <Corners /><Play size={16} strokeWidth={1.5} />Štart
                </button>
              )}
              <button className="btn btn-secondary" style={{ minHeight: 44, paddingInline: 14 }} onClick={() => setManualOpen(true)}>
                <Plus size={16} strokeWidth={1.5} />Ručne
              </button>
            </div>
          )}
        </Blueprint>

        <section>
          <div className="sec-head"><h4 style={{ margin: 0 }}>Diely</h4><span className="muted" style={{ fontSize: 13 }}>{eur(t.partsSum)}</span></div>
          <div>
            {job.parts.map(p => (
              <PartRow key={p.id} part={p} disabled={closed} onToggle={() => dispatch({ type: 'togglePart', jobId: job.id, partId: p.id })} />
            ))}
            {!job.parts.length && <div className="muted" style={{ fontSize: 13, padding: '6px 0' }}>Zatiaľ bez dielov.</div>}
          </div>
          {!closed && <button className="btn btn-ghost" style={{ marginTop: 6, minHeight: 44 }} onClick={() => setPartOpen(true)}>+ Pridať diel</button>}
        </section>

        <section>
          <div className="sec-head"><h4 style={{ margin: 0 }}>Fotky práce</h4><span className="muted" style={{ fontSize: 13 }}>{job.photos.length} / pred · počas · po</span></div>
          <div className="photo-grid">
            {job.photos.map(p => (
              <ImageSlot key={p.id} src={p.src} label={p.label} style={{ aspectRatio: '1' }}
                onPick={closed ? undefined : src => dispatch({ type: 'setPhoto', jobId: job.id, photoId: p.id, src })} />
            ))}
            {!closed && <AddPhotoTile onPick={addPhoto} />}
          </div>
        </section>

        <section>
          <div className="sec-head"><h4 style={{ margin: 0 }}>Diagnostika</h4>
            {!closed && <button className="btn btn-ghost" style={{ minHeight: 32 }} onClick={() => setCodeOpen(true)}>+ kód</button>}
          </div>
          {job.diagnostic ? (
            <Blueprint style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
              <FileText size={22} strokeWidth={1.5} style={{ color: 'var(--color-accent-700)', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.diagnostic.file}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {codes.length} {plural(codes.length, 'kód', 'kódy', 'kódov')}{codes.length ? ` · ${codes.map(c => c.code).join(', ')}` : ''} · importované {job.diagnostic.importedAt}
                </div>
              </div>
              <span className="tag tag-outline">{job.diagnostic.file.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Súbor'}</span>
            </Blueprint>
          ) : (
            <Blueprint as="button" className="btn btn-secondary" style={{ width: '100%', minHeight: 48, justifyContent: 'flex-start', gap: 12, padding: '12px 14px' }} onClick={() => diagInput.current?.click()}>
              <FileText size={22} strokeWidth={1.5} style={{ color: 'var(--color-accent-700)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14 }}>Importovať protokol (PDF)</span>
            </Blueprint>
          )}
          <input ref={diagInput} type="file" accept=".pdf,application/pdf,.txt,.csv" hidden
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) dispatch({ type: 'setDiagnostic', jobId: job.id, file: f.name }) }} />
        </section>

        {closed ? (
          <Link to={`/report/${job.id}`} className="btn btn-primary btn-block blueprint" style={{ minHeight: 48, fontSize: 15 }}>
            <Corners />Otvoriť report
          </Link>
        ) : (
          <button className="btn btn-primary btn-block blueprint" style={{ minHeight: 48, fontSize: 15 }}
            onClick={() => { dispatch({ type: 'closeJob', jobId: job.id }); nav(`/report/${job.id}`) }}>
            <Corners />Uzavrieť a vytvoriť report
          </button>
        )}
      </div>

      <ManualTimeDialog open={manualOpen} onClose={() => setManualOpen(false)} jobId={job.id} />
      <AddPartDialog open={partOpen} onClose={() => setPartOpen(false)} jobId={job.id} />
      <AddCodeDialog open={codeOpen} onClose={() => setCodeOpen(false)} jobId={job.id} />
    </div>
  )
}

function PartRow({ part, disabled, onToggle }: { part: Part; disabled: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="part-row" onClick={onToggle} disabled={disabled} aria-pressed={part.used}>
      <span className="part-box" style={{ background: part.used ? 'var(--color-accent)' : 'transparent' }}>
        {part.used && <Check size={12} strokeWidth={2.5} color="#fff" />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{part.name}</span>
        <span className="muted" style={{ display: 'block', fontSize: 11 }}>{part.meta}</span>
      </span>
      <span className="hd num" style={{ fontSize: 16, opacity: part.used ? 1 : 0.5 }}>{eur(part.price)}</span>
    </button>
  )
}

function AddPhotoTile({ onPick }: { onPick: (src: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <Blueprint as="button" className="add-tile" onClick={() => input.current?.click()}>
      <Camera size={26} strokeWidth={1.5} aria-label="Pridať fotku" />
      <input ref={input} type="file" accept="image/*" hidden
        onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { try { onPick(await fileToDataUrl(f)) } catch { /* ignore unreadable file */ } } }} />
    </Blueprint>
  )
}

