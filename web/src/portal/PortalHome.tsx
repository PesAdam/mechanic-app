import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { FileText, LogOut, Send } from 'lucide-react'
import { ApiError } from '../lib/api'
import { dateOf, isoDate, km, planLabel, skDate } from '../lib/format'
import type { PortalRequest, RequestPhase } from '../lib/types'
import AddPhotoTile from '../components/AddPhotoTile'
import Blueprint, { Corners } from '../components/Blueprint'
import ImageSlot from '../components/ImageSlot'
import { Loading } from '../components/Loading'
import PortalFrame from './PortalFrame'
import { isSignedIn, usePortalActions, usePortalMe, usePortalRequests, type NewRequest } from './data'

const PHASE: Record<RequestPhase, [string, string]> = {
  sent: ['Odoslané', 'tag-outline'],
  accepted: ['Prijaté', 'tag-accent'],
  in_progress: ['V práci', 'tag-accent'],
  done: ['Hotové', 'tag-neutral'],
  rejected: ['Zamietnuté', 'tag-neutral'],
}
const MAX_PHOTOS = 6
const EMPTY: Omit<NewRequest, 'photos'> = { plate: '', make: '', model: '', engine: '', vin: '', km: '', description: '', preferred_date: '' }

type Car = Pick<PortalRequest, 'plate' | 'make' | 'model' | 'engine' | 'vin'>

/** /portal — an invited client's whole world: send a car and what to do, follow what was sent. Nothing of the shop's system. */
export default function PortalHome() {
  const me = usePortalMe()
  const requests = usePortalRequests()
  const { logout, cancel } = usePortalActions()
  const [formOpen, setFormOpen] = useState<boolean | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const list = useMemo(() => requests.data ?? [], [requests.data])
  // Cars sent before, newest first, to fill the form with one tap.
  const cars = useMemo(() => {
    const seen = new Map<string, Car>()
    for (const r of list) if (!seen.has(r.plate)) seen.set(r.plate, { plate: r.plate, make: r.make, model: r.model, engine: r.engine, vin: r.vin })
    return [...seen.values()]
  }, [list])

  if (!isSignedIn()) return <Navigate to="/portal/prihlasenie" replace />
  if (me.error instanceof ApiError && me.error.status === 403) return <Blocked onLogout={() => void logout()} />
  if (!me.data || !requests.data) return <Loading text="Načítavam…" />

  const shop = me.data.shop
  // With nothing sent yet the form is open right away.
  const showForm = formOpen ?? list.length === 0
  const cancelRequest = async (r: PortalRequest) => {
    if (!window.confirm(`Zrušiť požiadavku pre ${r.plate}?`)) return
    setBusyId(r.id)
    setError(null)
    try { await cancel(r.id) } catch (err) { setError(err instanceof ApiError ? err.message : 'Požiadavku sa nepodarilo zrušiť.') } finally { setBusyId(null) }
  }

  return (
    <PortalFrame>
      <div className="screen-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="kicker">{shop.name}</div>
          <h1 style={{ fontSize: 32, margin: 0, lineHeight: 1 }}>Požiadavky</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void logout()}><LogOut size={16} strokeWidth={1.5} />Odhlásiť</button>
      </div>
      <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: -8 }}>
        {me.data.name} · Pošlite auto a čo na ňom treba urobiť, dielňa sa vám ozve.
        {shop.phone && <> Telefón do dielne: <a href={`tel:${shop.phone.replace(/\s+/g, '')}`}>{shop.phone}</a>.</>}
      </div>

      {showForm
        ? <RequestForm cars={cars} canCancel={list.length > 0} onDone={() => setFormOpen(false)} />
        : <button type="button" className="btn btn-primary btn-block blueprint" style={{ minHeight: 48, marginTop: 0 }} onClick={() => setFormOpen(true)}><Corners />+ Nová požiadavka</button>}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="sec-head" style={{ marginBottom: 0 }}><h4 style={{ margin: 0 }}>Odoslané</h4><span className="muted" style={{ fontSize: 13 }}>{list.length}</span></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        {list.map(r => <RequestCard key={r.id} r={r} busy={busyId === r.id} onCancel={() => void cancelRequest(r)} />)}
        {!list.length && <div className="muted" style={{ fontSize: 13 }}>Zatiaľ ste nič neposlali.</div>}
      </section>
    </PortalFrame>
  )
}

function RequestForm({ cars, canCancel, onDone }: { cars: Car[]; canCancel: boolean; onDone: () => void }) {
  const { send } = usePortalActions()
  const [f, setF] = useState(EMPTY)
  const [photos, setPhotos] = useState<Blob[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previews = useMemo(() => photos.map(p => URL.createObjectURL(p)), [photos])
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews])

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF(prev => ({ ...prev, [k]: e.target.value }))
  const pickCar = (c: Car) => setF(prev => ({ ...prev, plate: c.plate, make: c.make, model: c.model, engine: c.engine ?? '', vin: c.vin ?? '' }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await send({ ...f, photos })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Požiadavku sa nepodarilo odoslať.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Blueprint style={{ padding: 18 }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Nová požiadavka">
        <div className="card-title">Nová požiadavka</div>
        {cars.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {cars.map(c => <button key={c.plate} type="button" className="btn btn-secondary" style={{ minHeight: 32, fontSize: 12 }} onClick={() => pickCar(c)}>{c.plate} · {c.make} {c.model}</button>)}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label htmlFor="rq-plate">ŠPZ</label><input id="rq-plate" className="input" value={f.plate} onChange={set('plate')} required maxLength={16} style={{ textTransform: 'uppercase' }} /></div>
          <div className="field"><label htmlFor="rq-km">Stav km (nepovinné)</label><input id="rq-km" className="input" inputMode="numeric" pattern="[0-9 ]*" value={f.km} onChange={set('km')} /></div>
          <div className="field"><label htmlFor="rq-make">Značka</label><input id="rq-make" className="input" value={f.make} onChange={set('make')} required maxLength={64} placeholder="Škoda" /></div>
          <div className="field"><label htmlFor="rq-model">Model</label><input id="rq-model" className="input" value={f.model} onChange={set('model')} required maxLength={128} placeholder="Octavia III" /></div>
          <div className="field"><label htmlFor="rq-engine">Motor (nepovinné)</label><input id="rq-engine" className="input" value={f.engine} onChange={set('engine')} maxLength={64} placeholder="2.0 TDI" /></div>
          <div className="field"><label htmlFor="rq-vin">VIN (nepovinné)</label><input id="rq-vin" className="input" value={f.vin} onChange={set('vin')} maxLength={17} style={{ textTransform: 'uppercase' }} /></div>
        </div>
        <div className="field"><label htmlFor="rq-desc">Čo treba urobiť</label>
          <textarea id="rq-desc" className="input" value={f.description} onChange={set('description')} required maxLength={2000}
            placeholder="Napr. výmena oleja a filtrov, pískajú brzdy vpredu, svieti kontrolka motora…" />
        </div>
        <div className="field"><label htmlFor="rq-date">Kedy by ste chceli prísť (nepovinné)</label><input id="rq-date" className="input" type="date" min={isoDate(new Date())} value={f.preferred_date} onChange={set('preferred_date')} /></div>
        <div className="field">
          <label>Fotky (nepovinné, najviac {MAX_PHOTOS})</label>
          <div className="photo-grid">
            {previews.map((src, i) => <ImageSlot key={src} src={src} label={`Fotka ${i + 1}`} style={{ aspectRatio: '1' }} onRemove={() => setPhotos(ps => ps.filter((_, j) => j !== i))} />)}
            {photos.length < MAX_PHOTOS && <AddPhotoTile onPick={blobs => setPhotos(ps => [...ps, ...blobs].slice(0, MAX_PHOTOS))} />}
          </div>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {canCancel && <button type="button" className="btn btn-secondary" onClick={onDone} disabled={busy}>Zrušiť</button>}
          <button type="submit" className="btn btn-primary blueprint" disabled={busy}><Corners /><Send size={16} strokeWidth={1.5} />{busy ? 'Odosielam…' : 'Odoslať dielni'}</button>
        </div>
      </form>
    </Blueprint>
  )
}

function RequestCard({ r, busy, onCancel }: { r: PortalRequest; busy: boolean; onCancel: () => void }) {
  const [label, cls] = PHASE[r.phase]
  return (
    <Blueprint className="card" style={{ padding: 14, gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <b>{r.plate} · {r.make} {r.model}{r.engine ? ` ${r.engine}` : ''}</b>
        <span className={`tag ${cls}`}>{label}</span>
      </div>
      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.description}</div>
      <div className="muted" style={{ fontSize: 12 }}>
        Odoslané {skDate(dateOf(r.created_at))}{r.preferred_date ? ` · chcete prísť ${skDate(r.preferred_date)}` : ''}{r.km ? ` · ${km(r.km)}` : ''}
      </div>
      {r.photos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {r.photos.map((src, i) => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Fotka ${i + 1}`} style={{ width: 56, height: 56, objectFit: 'cover', display: 'block' }} /></a>)}
        </div>
      )}
      {r.order && (
        <div style={{ fontSize: 13 }}>
          Zákazka #{r.order.number}{r.order.planned_at ? ` · termín ${planLabel(r.order.planned_at, Date.now())}` : r.phase === 'accepted' ? ' · termín vám dielňa oznámi' : ''}
        </div>
      )}
      {r.order?.report_token && <a className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} href={`/r/${r.order.report_token}`}><FileText size={16} strokeWidth={1.5} />Zobraziť report</a>}
      {r.phase === 'rejected' && <div style={{ fontSize: 13 }}>{r.reject_reason ? `Dielňa: ${r.reject_reason}` : 'Dielňa túto požiadavku neprijala.'}</div>}
      {r.phase === 'sent' && <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start', fontSize: 13 }} disabled={busy} onClick={onCancel}>Zrušiť požiadavku</button>}
    </Blueprint>
  )
}

function Blocked({ onLogout }: { onLogout: () => void }) {
  return (
    <PortalFrame>
      <div style={{ margin: 'auto 0' }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>Účet nie je aktívny</h1>
        <div className="muted" style={{ fontSize: 14, marginTop: 10 }}>Dielňa váš prístup vypla. Ak je to omyl, ozvite sa jej.</div>
        <button type="button" className="btn btn-secondary" style={{ marginTop: 16 }} onClick={onLogout}>Odhlásiť</button>
      </div>
    </PortalFrame>
  )
}
