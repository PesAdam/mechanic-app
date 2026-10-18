import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeft, FileText, Pause, Play, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useOrder, useOrderActions, useSettings } from '../data/queries'
import { useNow } from '../lib/useNow'
import { useAction } from '../lib/useAction'
import { firstName, isClosed, isRunning, normClass, opOf, runningEntry, runningEntryOf, sessionSeconds, totalsOf, carName } from '../lib/calc'
import { eur, hm, hms, km, timeOf } from '../lib/format'
import { lowerFirst, plural } from '../lib/text'
import type { Part, PhotoStage } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'
import ImageSlot from '../components/ImageSlot'
import StatusTag from '../components/StatusTag'
import NotFound from '../components/NotFound'
import { Loading } from '../components/Loading'
import JobViewSwitch from '../components/JobViewSwitch'
import PartRow from '../components/PartRow'
import PricingSwitch from '../components/PricingSwitch'
import CloseOrderDialog from '../components/CloseOrderDialog'
import AddPhotoTile from '../components/AddPhotoTile'
import ShareReport from '../components/ShareReport'
import NormBadge from '../components/NormBadge'
import OperationsSection from '../components/OperationsSection'
import { AddCodeDialog, AddPartDialog, AssignEntryDialog, ManualTimeDialog } from '../components/JobDialogs'

const STAGE_LABEL: Record<PhotoStage, string> = { pred: 'Pred', pocas: 'Počas', po: 'Po' }

/** 1a · Zákazka — the stopwatch in the middle, parts and photos below. */
export default function JobDetail() {
  const { id } = useParams()
  const orderId = Number(id)
  const { user } = useAuth()
  const q = useOrder(orderId)
  const settings = useSettings()
  const actions = useOrderActions()
  const act = useAction()
  const order = q.data
  const now = useNow(!!order && isRunning(order))
  const [manualOpen, setManualOpen] = useState(false)
  const [partOpen, setPartOpen] = useState(false)
  const [editPart, setEditPart] = useState<Part | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const diagInput = useRef<HTMLInputElement>(null)

  if (!order) return q.isPending ? <Loading text="Načítavam zákazku…" /> : <NotFound />

  const rate = settings.data?.hourly_rate ?? 28
  const t = totalsOf(order, rate, now, settings.data?.labor_billing)
  const closed = isClosed(order)
  const run = runningEntry(order)
  const mine = user ? runningEntryOf(order, user.id) : null
  const whoId = run?.user.id ?? user?.id ?? 0
  const who = firstName(run?.user.name ?? user?.name)
  // A closed order has no "today": the big figure becomes the whole time on the car.
  const session = closed ? t.seconds : sessionSeconds(order, whoId, now)
  const codes = order.diagnostic?.codes ?? []
  const brand = settings.data?.business.name ?? 'Dielňa'

  const nextStage = (): PhotoStage => (closed ? 'po' : order.work_entries.length ? 'pocas' : 'pred')
  const addPhotos = (blobs: Blob[]) => {
    const stage = nextStage()
    const n = order.photos.filter(p => p.stage === stage).length + 1
    void act.run(async () => {
      for (const [i, blob] of blobs.entries()) await actions.uploadPhoto(order.id, { blob, label: `${STAGE_LABEL[stage]} ${n + i}`, stage })
    })
  }
  const toggleTimer = () => void act.run(() => (mine ? actions.stopTimer(order.id) : actions.startTimer(order.id)))

  return (
    <div className="phone">
      <div className="screen">
        <div className="screen-head">
          <Link to="/m" className="back" aria-label="Späť do dielne">
            <ChevronLeft size={20} strokeWidth={1.5} />
            <span className="hd" style={{ fontSize: 18 }}>{brand}</span>
          </Link>
          <StatusTag status={order.status} />
        </div>

        <JobViewSwitch id={order.id} view="detail" />

        <div>
          <div className="kicker">Zákazka #{order.number} · {order.customer.name}</div>
          <h2 style={{ fontSize: 28, margin: '2px 0 0' }}>{carName(order.car)}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{order.car.plate} · {km(order.car.km)} · {lowerFirst(order.summary)}</div>
        </div>

        <Blueprint style={{ padding: '22px 16px 18px', textAlign: 'center' }}>
          <div className="kicker-muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <i className={run ? 'dot live' : 'dot'} />{closed ? 'Uzavreté · celkom' : `Dnes · ${who}`}
          </div>
          <div className={`hd num ${normClass(t.seconds, t.norm_seconds)}`} style={{ fontSize: 64, lineHeight: 1, letterSpacing: '-.02em', margin: '6px 0 4px' }}>{hms(session)}</div>
          <div className="muted" style={{ fontSize: 12 }}>Celkom na aute {hm(t.seconds)} · {eur(t.labor)}</div>
          {t.norm_seconds > 0 && <div style={{ fontSize: 12, marginTop: 4 }}>Norma {hm(t.norm_seconds)} · <NormBadge seconds={t.seconds} normSeconds={t.norm_seconds} rate={rate} /></div>}
          {mine && !closed && (
            <div style={{ fontSize: 13, marginTop: 8 }}>
              {opOf(order, mine.order_operation_id)
                ? <>Robím: <b>{opOf(order, mine.order_operation_id)?.name}</b> · <button type="button" className="linkbtn" onClick={() => setAssignOpen(true)}>zmeniť</button></>
                : <>Čas bez úkonu{order.operations.length ? <> · <button type="button" className="linkbtn" onClick={() => setAssignOpen(true)}>priradiť k úkonu</button></> : null}</>}
            </div>
          )}
          {!closed && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {mine ? (
                <button className="btn btn-secondary" style={{ flex: 1, minHeight: 44 }} onClick={toggleTimer} disabled={act.busy}>
                  <Pause size={16} strokeWidth={1.5} />Pauza
                </button>
              ) : (
                <button className="btn btn-primary blueprint" style={{ flex: 1, minHeight: 44 }} onClick={toggleTimer} disabled={act.busy}>
                  <Corners /><Play size={16} strokeWidth={1.5} />Štart
                </button>
              )}
              <button className="btn btn-secondary" style={{ minHeight: 44, paddingInline: 14 }} onClick={() => setManualOpen(true)} disabled={act.busy}>
                <Plus size={16} strokeWidth={1.5} />Ručne
              </button>
            </div>
          )}
          {run && user && run.user.id !== user.id && !closed && (
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Na aute práve robí {firstName(run.user.name)}.</div>
          )}
          {act.error && <div className="form-error" role="alert" style={{ marginTop: 10 }}>{act.error}</div>}
        </Blueprint>

        <section style={{ display: 'flex', flexDirection: 'column' }}>
          <OperationsSection order={order} closed={closed} now={now} rate={rate} />
        </section>

        <section>
          <div className="sec-head"><h4 style={{ margin: 0 }}>Diely</h4>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!closed && <PricingSwitch order={order} compact disabled={act.busy} />}
              <span className="muted" style={{ fontSize: 13 }}>{eur(t.parts)}{closed ? ` · ${order.parts_pricing === 'nc' ? 'NC' : 'MOC'}` : ''}</span>
            </span>
          </div>
          <div>
            {order.parts.map(p => (
              <PartRow key={p.id} part={p} mode={order.parts_pricing} disabled={closed || act.busy} onToggle={() => void act.run(() => actions.updatePart(p.id, { used: !p.used }))} onEdit={() => setEditPart(p)} />
            ))}
            {!order.parts.length && <div className="muted" style={{ fontSize: 13, padding: '6px 0' }}>Zatiaľ bez dielov.</div>}
          </div>
          {!closed && <button className="btn btn-ghost" style={{ marginTop: 6, minHeight: 44 }} onClick={() => setPartOpen(true)}>+ Pridať diel</button>}
        </section>

        <section>
          <div className="sec-head"><h4 style={{ margin: 0 }}>Fotky práce</h4><span className="muted" style={{ fontSize: 13 }}>{order.photos.length} / pred · počas · po</span></div>
          <div className="photo-grid">
            {order.photos.map(p => (
              <ImageSlot key={p.id} src={p.url} label={p.label} style={{ aspectRatio: '1' }}
                onPick={closed ? undefined : blob => void act.run(() => actions.uploadPhoto(order.id, { blob, label: p.label, stage: p.stage, photo_id: p.id }))}
                    onRemove={closed ? undefined : () => { if (window.confirm(`Zmazať fotku „${p.label}“?`)) void act.run(() => actions.removePhoto(p.id)) }} />
            ))}
            {!closed && <AddPhotoTile onPick={addPhotos} />}
          </div>
        </section>

        <section>
          <div className="sec-head"><h4 style={{ margin: 0 }}>Diagnostika</h4>
            {!closed && <button className="btn btn-ghost" style={{ minHeight: 32 }} onClick={() => setCodeOpen(true)}>+ kód</button>}
          </div>
          {order.diagnostic ? (
            <Blueprint style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
              <FileText size={22} strokeWidth={1.5} style={{ color: 'var(--color-accent-700)', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {order.diagnostic.file_url ? <a href={order.diagnostic.file_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{order.diagnostic.file_name}</a> : order.diagnostic.file_name}
                </div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {codes.length} {plural(codes.length, 'kód', 'kódy', 'kódov')}{codes.length ? ` · ${codes.map(c => c.code).join(', ')}` : ''} · importované {timeOf(order.diagnostic.imported_at)}
                </div>
              </div>
              {order.diagnostic.file_url
                ? <span className="tag tag-outline">{order.diagnostic.file_name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Súbor'}</span>
                : !closed && <button className="btn btn-ghost" style={{ minHeight: 32 }} onClick={() => diagInput.current?.click()}>Priložiť</button>}
            </Blueprint>
          ) : (
            <Blueprint as="button" className="btn btn-secondary" style={{ width: '100%', minHeight: 48, justifyContent: 'flex-start', gap: 12, padding: '12px 14px' }} onClick={() => diagInput.current?.click()}>
              <FileText size={22} strokeWidth={1.5} style={{ color: 'var(--color-accent-700)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14 }}>Importovať protokol (PDF)</span>
            </Blueprint>
          )}
          <input ref={diagInput} type="file" accept=".pdf,application/pdf,.txt,.csv,.log" hidden
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void act.run(() => actions.uploadDiagnostic(order.id, f)) }} />
        </section>

        {closed ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ShareReport order={order} />
            <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Zákazník dostane odkaz na online report s dokladom a platbou.</div>
          </section>
        ) : (
          <button className="btn btn-primary btn-block blueprint" style={{ minHeight: 48, fontSize: 15 }} onClick={() => setCloseOpen(true)} disabled={act.busy}>
            <Corners />Uzavrieť a vytvoriť report
          </button>
        )}
      </div>

      <ManualTimeDialog open={manualOpen} onClose={() => setManualOpen(false)} orderId={order.id} operations={order.operations} />
      <AssignEntryDialog open={assignOpen} onClose={() => setAssignOpen(false)} order={order} entry={mine} />
      <AddPartDialog open={partOpen} onClose={() => setPartOpen(false)} orderId={order.id} />
      <AddPartDialog open={!!editPart} onClose={() => setEditPart(null)} orderId={order.id} part={editPart ?? undefined} />
      {closeOpen && <CloseOrderDialog order={order} rate={rate} now={now} billing={settings.data?.labor_billing} open onClose={() => setCloseOpen(false)} />}
      <AddCodeDialog open={codeOpen} onClose={() => setCodeOpen(false)} orderId={order.id} />
    </div>
  )
}
