import { Fragment, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Camera, ChevronLeft, Download, Wrench } from 'lucide-react'
import { totalsOf, useNow, useWorkshop } from '../store/workshop'
import { eur, hm, hms } from '../lib/format'
import { fileToDataUrl } from '../lib/image'
import { buildTimeline } from '../lib/timeline'
import type { PhotoStage } from '../lib/types'
import { business } from '../data/business'
import { Corners } from '../components/Blueprint'
import ImageSlot from '../components/ImageSlot'
import NotFound from '../components/NotFound'
import JobViewSwitch from '../components/JobViewSwitch'
import { AddPartDialog } from '../components/JobDialogs'
import { useThemeColor } from '../lib/pwa'

/** 1b · Zákazka ako denník — time, parts and photos on one timeline. */
export default function JobDiary() {
  const { id } = useParams()
  const { state, dispatch, mechName } = useWorkshop()
  const job = state.jobs.find(j => j.id === id)
  const now = useNow(!!job?.timer.running)
  const [partOpen, setPartOpen] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const diagInput = useRef<HTMLInputElement>(null)
  useThemeColor('#1d2d3d')

  if (!job) return <NotFound />

  const t = totalsOf(job, state.hourlyRate, now)
  const closed = job.status === 'unpaid' || job.status === 'done'
  const events = buildTimeline(job, mechName, now)

  const addPhoto = (src: string) => {
    const stage: PhotoStage = closed ? 'po' : job.work.length || t.elapsed > 0 ? 'pocas' : 'pred'
    const n = job.photos.filter(p => p.stage === stage).length + 1
    dispatch({ type: 'addPhoto', jobId: job.id, photo: { label: `${stage === 'pred' ? 'Pred' : stage === 'po' ? 'Po' : 'Počas'} ${n}`, stage, src } })
  }

  return (
    <div className="phone">
      <div className="diary-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.8 }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }} aria-label="Späť do dielne">
            <ChevronLeft size={14} strokeWidth={1.5} />{business.name}
          </Link>
          <span>#{job.id}</span>
        </div>
        <h2 style={{ fontSize: 30, margin: '10px 0 0', color: 'var(--color-bg)' }}>{job.car.model}</h2>
        <div style={{ fontSize: 13, opacity: 0.8 }}>{job.customer.name} · {job.car.plate}</div>
        <div className="stat3">
          <div><div className="stat3-k">Čas</div><div className="hd num" style={{ fontSize: 24 }}>{hm(t.totalSec)}</div></div>
          <div><div className="stat3-k">Diely</div><div className="hd" style={{ fontSize: 24 }}>{eur(t.partsSum)}</div></div>
          <div><div className="stat3-k">Spolu</div><div className="hd" style={{ fontSize: 24 }}>{eur(t.grand)}</div></div>
        </div>
      </div>

      <div style={{ padding: '18px 18px 0', display: 'flex' }}><JobViewSwitch id={job.id} view="diary" /></div>

      {!closed && (
        <div style={{ padding: '14px 18px 0', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary blueprint" style={{ flex: 1, minHeight: 44 }} onClick={() => dispatch({ type: 'toggleTimer', jobId: job.id })}>
            <Corners />{job.timer.running ? 'Pauza' : 'Štart'} · <span className="num">{hms(t.elapsed)}</span>
          </button>
          <button className="btn btn-secondary btn-icon" style={{ width: 44, height: 44 }} aria-label="Fotka" onClick={() => photoInput.current?.click()}>
            <Camera size={18} strokeWidth={1.5} />
          </button>
          <button className="btn btn-secondary btn-icon" style={{ width: 44, height: 44 }} aria-label="Diel" onClick={() => setPartOpen(true)}>
            <Wrench size={18} strokeWidth={1.5} />
          </button>
          <button className="btn btn-secondary btn-icon" style={{ width: 44, height: 44 }} aria-label="Diagnostika" onClick={() => diagInput.current?.click()}>
            <Download size={18} strokeWidth={1.5} />
          </button>
          <input ref={photoInput} type="file" accept="image/*" hidden
            onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { try { addPhoto(await fileToDataUrl(f)) } catch { /* ignore */ } } }} />
          <input ref={diagInput} type="file" accept=".pdf,application/pdf,.txt,.csv" hidden
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) dispatch({ type: 'setDiagnostic', jobId: job.id, file: f.name }) }} />
        </div>
      )}

      <div className="tl">
        {events.map(ev => (
          <Fragment key={ev.id}>
            <div className={ev.live ? 'tl-time live' : 'tl-time'}>{ev.time}</div>
            <div className={ev.live ? 'tl-body live' : 'tl-body'}>
              <i className={ev.live ? 'tl-dot live' : 'tl-dot'} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{ev.title}</span>
                {ev.right && <span className="hd num" style={{ whiteSpace: 'nowrap' }}>{ev.right}</span>}
              </div>
              {ev.text && <div className="muted" style={{ fontSize: 12 }}>{ev.text}</div>}
              {ev.photos && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  {ev.photos.map(p => (
                    <ImageSlot key={p.id} src={p.src} label={p.label} style={{ aspectRatio: '4 / 3' }}
                      onPick={closed ? undefined : src => dispatch({ type: 'setPhoto', jobId: job.id, photoId: p.id, src })} />
                  ))}
                </div>
              )}
            </div>
          </Fragment>
        ))}
        {!events.length && <><div /><div className="muted" style={{ fontSize: 13 }}>Denník je prázdny. Spustite stopky alebo pridajte fotku.</div></>}
      </div>

      <AddPartDialog open={partOpen} onClose={() => setPartOpen(false)} jobId={job.id} />
    </div>
  )
}
