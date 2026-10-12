import { Fragment, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Camera, ChevronLeft, Download, Wrench } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useOrder, useOrderActions, useSettings } from '../data/queries'
import { useNow } from '../lib/useNow'
import { useAction } from '../lib/useAction'
import { isClosed, isRunning, runningEntryOf, sessionSeconds, totalsOf } from '../lib/calc'
import { eur, hm, hms } from '../lib/format'
import { resizeImage } from '../lib/image'
import { buildTimeline } from '../lib/timeline'
import { useThemeColor } from '../lib/pwa'
import type { PhotoStage } from '../lib/types'
import { Corners } from '../components/Blueprint'
import ImageSlot from '../components/ImageSlot'
import NotFound from '../components/NotFound'
import { Loading } from '../components/Loading'
import JobViewSwitch from '../components/JobViewSwitch'
import { AddPartDialog } from '../components/JobDialogs'

/** 1b · Zákazka ako denník — time, parts and photos on one timeline. */
export default function JobDiary() {
  const { id } = useParams()
  const orderId = Number(id)
  const { user } = useAuth()
  const q = useOrder(orderId)
  const settings = useSettings()
  const actions = useOrderActions()
  const act = useAction()
  const order = q.data
  const now = useNow(!!order && isRunning(order))
  const [partOpen, setPartOpen] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const diagInput = useRef<HTMLInputElement>(null)
  useThemeColor('#1d2d3d')

  if (!order) return q.isPending ? <Loading text="Načítavam denník…" /> : <NotFound />

  const rate = settings.data?.hourly_rate ?? 28
  const t = totalsOf(order, rate, now, settings.data?.labor_billing)
  const closed = isClosed(order)
  const mine = user ? runningEntryOf(order, user.id) : null
  const session = user ? sessionSeconds(order, user.id, now) : 0
  const events = buildTimeline(order, now)
  const brand = settings.data?.business.name ?? 'Dielňa'

  const addPhoto = (blob: Blob) => {
    const stage: PhotoStage = closed ? 'po' : order.work_entries.length ? 'pocas' : 'pred'
    const n = order.photos.filter(p => p.stage === stage).length + 1
    void act.run(() => actions.uploadPhoto(order.id, { blob, label: `${stage === 'pred' ? 'Pred' : stage === 'po' ? 'Po' : 'Počas'} ${n}`, stage }))
  }

  return (
    <div className="phone">
      <div className="diary-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.8 }}>
          <Link to="/m" style={{ color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }} aria-label="Späť do dielne">
            <ChevronLeft size={14} strokeWidth={1.5} />{brand}
          </Link>
          <span>#{order.number}</span>
        </div>
        <h2 style={{ fontSize: 30, margin: '10px 0 0', color: 'var(--color-bg)' }}>{order.car.model}</h2>
        <div style={{ fontSize: 13, opacity: 0.8 }}>{order.customer.name} · {order.car.plate}</div>
        <div className="stat3">
          <div><div className="stat3-k">Čas</div><div className="hd num" style={{ fontSize: 24 }}>{hm(t.seconds)}</div></div>
          <div><div className="stat3-k">Diely</div><div className="hd" style={{ fontSize: 24 }}>{eur(t.parts)}</div></div>
          <div><div className="stat3-k">Spolu</div><div className="hd" style={{ fontSize: 24 }}>{eur(t.grand)}</div></div>
        </div>
      </div>

      <div style={{ padding: '18px 18px 0', display: 'flex' }}><JobViewSwitch id={order.id} view="diary" /></div>

      {!closed && (
        <div style={{ padding: '14px 18px 0', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary blueprint" style={{ flex: 1, minHeight: 44 }} disabled={act.busy}
            onClick={() => void act.run(() => (mine ? actions.stopTimer(order.id) : actions.startTimer(order.id)))}>
            <Corners />{mine ? 'Pauza' : 'Štart'} · <span className="num">{hms(session)}</span>
          </button>
          <button className="btn btn-secondary btn-icon" style={{ width: 44, height: 44 }} aria-label="Fotka" onClick={() => photoInput.current?.click()} disabled={act.busy}>
            <Camera size={18} strokeWidth={1.5} />
          </button>
          <button className="btn btn-secondary btn-icon" style={{ width: 44, height: 44 }} aria-label="Diel" onClick={() => setPartOpen(true)} disabled={act.busy}>
            <Wrench size={18} strokeWidth={1.5} />
          </button>
          <button className="btn btn-secondary btn-icon" style={{ width: 44, height: 44 }} aria-label="Diagnostika" onClick={() => diagInput.current?.click()} disabled={act.busy}>
            <Download size={18} strokeWidth={1.5} />
          </button>
          <input ref={photoInput} type="file" accept="image/*" hidden
            onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { try { addPhoto(await resizeImage(f)) } catch { /* ignore */ } } }} />
          <input ref={diagInput} type="file" accept=".pdf,application/pdf,.txt,.csv,.log" hidden
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void act.run(() => actions.uploadDiagnostic(order.id, f)) }} />
        </div>
      )}
      {act.error && <div className="form-error" role="alert" style={{ margin: '10px 18px 0' }}>{act.error}</div>}

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
                    <ImageSlot key={p.id} src={p.url} label={p.label} style={{ aspectRatio: '4 / 3' }}
                      onPick={closed ? undefined : blob => void act.run(() => actions.uploadPhoto(order.id, { blob, label: p.label, stage: p.stage, photo_id: p.id }))} />
                  ))}
                </div>
              )}
            </div>
          </Fragment>
        ))}
        {!events.length && <><div /><div className="muted" style={{ fontSize: 13 }}>Denník je prázdny. Spustite stopky alebo pridajte fotku.</div></>}
      </div>

      <AddPartDialog open={partOpen} onClose={() => setPartOpen(false)} orderId={order.id} />
    </div>
  )
}
