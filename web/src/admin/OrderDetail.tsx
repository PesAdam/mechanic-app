import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Check, FileText, Pause, Play, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useOrder, useOrderActions, useSettings, useUsers } from '../data/queries'
import { useNow } from '../lib/useNow'
import { useAction } from '../lib/useAction'
import { entrySeconds, firstName, isClosed, isRunning, normClass, runningEntryOf, totalsOf, carName } from '../lib/calc'
import { dateOf, eur, hm, hms, hoursSk, km, shortVin, skDate, timeOf } from '../lib/format'
import { publicReportUrl } from '../lib/share'
import type { CodeStatus, Part, PhotoStage, WorkEntry } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'
import ImageSlot from '../components/ImageSlot'
import StatusTag from '../components/StatusTag'
import PartRow from '../components/PartRow'
import PricingSwitch from '../components/PricingSwitch'
import CloseOrderDialog from '../components/CloseOrderDialog'
import NormBadge from '../components/NormBadge'
import OperationsSection from '../components/OperationsSection'
import AddPhotoTile from '../components/AddPhotoTile'
import ShareReport from '../components/ShareReport'
import MakeLogo from '../components/MakeLogo'
import { AddCodeDialog, AddPartDialog, ManualTimeDialog } from '../components/JobDialogs'

const STAGE_LABEL: Record<PhotoStage, string> = { pred: 'Pred', pocas: 'Počas', po: 'Po' }
const CODE_TAG: Record<CodeStatus, [string, string]> = { fixed: ['Odstránené', 'tag-accent'], watch: ['Sledovať', 'tag-neutral'], open: ['Otvorené', 'tag-outline'] }

/** Desktop detail of an order: time, parts, photos, diagnostics and the sums side by side. */
export default function OrderDetail() {
  const { id } = useParams()
  const orderId = Number(id)
  const { user } = useAuth()
  const q = useOrder(orderId)
  const settings = useSettings()
  const users = useUsers()
  const actions = useOrderActions()
  const act = useAction()
  const order = q.data
  const now = useNow(!!order && isRunning(order))
  const [manualOpen, setManualOpen] = useState(false)
  const [partOpen, setPartOpen] = useState(false)
  const [editPart, setEditPart] = useState<Part | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const diagInput = useRef<HTMLInputElement>(null)

  if (!order) {
    return <Blueprint style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>{q.isPending ? 'Načítavam zákazku…' : 'Zákazka sa nenašla.'} {!q.isPending && <Link to="/admin/zakazky">Späť na zákazky</Link>}</div></Blueprint>
  }

  const rate = settings.data?.hourly_rate ?? 28
  const t = totalsOf(order, rate, now, settings.data?.labor_billing)
  const closed = isClosed(order)
  const mine = user ? runningEntryOf(order, user.id) : null
  const codes = order.diagnostic?.codes ?? []

  const addPhotos = (blobs: Blob[]) => {
    const stage: PhotoStage = closed ? 'po' : order.work_entries.length ? 'pocas' : 'pred'
    const n = order.photos.filter(p => p.stage === stage).length + 1
    void act.run(async () => {
      for (const [i, blob] of blobs.entries()) await actions.uploadPhoto(order.id, { blob, label: `${STAGE_LABEL[stage]} ${n + i}`, stage })
    })
  }

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <div className="kicker"><Link to="/admin/zakazky">Zákazky</Link> · #{order.number}{order.received_at ? ` · prijaté ${skDate(dateOf(order.received_at))} ${timeOf(order.received_at)}` : ''}</div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}><MakeLogo name={order.car.make} url={order.car.logo_url} size={34} decorative />{carName(order.car)}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{order.car.plate} · {km(order.car.km)} · VIN {shortVin(order.car.vin)} · {order.customer.name}{order.customer.phone ? ` · ${order.customer.phone}` : ''}</div>
        </div>
        <div className="admin-actions">
          <StatusTag status={order.status} />
          {!closed && <button className="btn btn-primary blueprint" style={{ minHeight: 36 }} onClick={() => setCloseOpen(true)} disabled={act.busy}><Corners />Uzavrieť a vytvoriť report</button>}
          {closed && <Link className="btn btn-primary blueprint" style={{ minHeight: 36 }} to={`/admin/reporty/${order.id}`}><Corners /><FileText size={16} strokeWidth={1.5} />Report</Link>}
          {order.status === 'unpaid' && <button className="btn btn-secondary" style={{ minHeight: 36 }} onClick={() => void act.run(() => actions.updateOrder(order.id, { status: 'done' }))} disabled={act.busy}><Check size={16} strokeWidth={1.5} />Označiť ako uhradené</button>}
        </div>
      </div>
      {act.error && <div className="form-error" role="alert">{act.error}</div>}

      <div className="order-grid">
        <div className="order-col">
          <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
            <div className="sec-head" style={{ marginBottom: 0 }}><span className="card-title">Úkony</span><span className="muted" style={{ fontSize: 13 }}>{t.norm_seconds ? `norma ${hm(t.norm_seconds)}` : 'bez normy'}</span></div>
            <OperationsSection order={order} closed={closed} title={false} />
          </Blueprint>

          <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
            <div className="sec-head" style={{ marginBottom: 0 }}><span className="card-title">Čas pri aute</span><span className={`hd num ${normClass(t.seconds, t.norm_seconds)}`}>{hm(t.seconds)}</span></div>
            {t.norm_seconds > 0 && <div style={{ fontSize: 13 }}>Norma {hm(t.norm_seconds)} · <NormBadge seconds={t.seconds} normSeconds={t.norm_seconds} rate={rate} size={13} /></div>}
            <div>
              {order.work_entries.map(e => <EntryRow key={e.id} entry={e} now={now} />)}
              {!order.work_entries.length && <div className="muted" style={{ fontSize: 13 }}>Zatiaľ bez zapísanej práce.</div>}
            </div>
            {!closed && (
              <div style={{ display: 'flex', gap: 8 }}>
                {mine
                  ? <button className="btn btn-secondary" onClick={() => void act.run(() => actions.stopTimer(order.id))} disabled={act.busy}><Pause size={16} strokeWidth={1.5} />Pauza</button>
                  : <button className="btn btn-primary blueprint" onClick={() => void act.run(() => actions.startTimer(order.id))} disabled={act.busy}><Corners /><Play size={16} strokeWidth={1.5} />Štart (ja)</button>}
                <button className="btn btn-secondary" onClick={() => setManualOpen(true)} disabled={act.busy}><Plus size={16} strokeWidth={1.5} />Ručný zápis</button>
              </div>
            )}
          </Blueprint>

          <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
            <div className="sec-head" style={{ marginBottom: 0 }}><span className="card-title">Diely</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><PricingSwitch order={order} compact disabled={act.busy} /><span className="hd num">{eur(t.parts)}</span></span>
            </div>
            <div>
              {order.parts.map(p => <PartRow key={p.id} part={p} mode={order.parts_pricing} disabled={closed || act.busy} onToggle={() => void act.run(() => actions.updatePart(p.id, { used: !p.used }))} onEdit={() => setEditPart(p)} />)}
              {!order.parts.length && <div className="muted" style={{ fontSize: 13 }}>Zatiaľ bez dielov.</div>}
            </div>
            {!closed && <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setPartOpen(true)}>+ Pridať diel</button>}
          </Blueprint>
        </div>

        <div className="order-col">
          <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
            <div className="sec-head" style={{ marginBottom: 0 }}><span className="card-title">Fotky</span><span className="muted" style={{ fontSize: 13 }}>{order.photos.length}</span></div>
            <div className="photo-grid">
              {order.photos.map(p => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <ImageSlot src={p.url} label={p.label} style={{ aspectRatio: '1', width: '100%', flex: 'none' }}
                    onPick={closed ? undefined : blob => void act.run(() => actions.uploadPhoto(order.id, { blob, label: p.label, stage: p.stage, photo_id: p.id }))}
                    onRemove={closed ? undefined : () => { if (window.confirm(`Zmazať fotku „${p.label}“?`)) void act.run(() => actions.removePhoto(p.id)) }} />
                  <span className="muted" style={{ fontSize: 11 }}>{p.label}{p.url && <> · <a href={p.url} target="_blank" rel="noreferrer">otvoriť</a></>}</span>
                </div>
              ))}
              {!closed && <AddPhotoTile onPick={addPhotos} />}
            </div>
          </Blueprint>

          <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
            <div className="sec-head" style={{ marginBottom: 0 }}>
              <span className="card-title">Diagnostika</span>
              {!closed && <span style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-ghost" style={{ minHeight: 30 }} onClick={() => diagInput.current?.click()}>Priložiť protokol</button>
                <button className="btn btn-ghost" style={{ minHeight: 30 }} onClick={() => setCodeOpen(true)}>+ kód</button>
              </span>}
            </div>
            {order.diagnostic ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <FileText size={16} strokeWidth={1.5} style={{ color: 'var(--color-accent-700)' }} />
                  {order.diagnostic.file_url ? <a href={order.diagnostic.file_url} target="_blank" rel="noreferrer">{order.diagnostic.file_name}</a> : <span>{order.diagnostic.file_name}</span>}
                  <span className="muted">· {timeOf(order.diagnostic.imported_at)}</span>
                </div>
                {codes.length ? (
                  <table className="table" style={{ fontSize: 13 }}>
                    <thead><tr><th>Kód</th><th>Popis</th><th>Jednotka</th><th>Stav</th></tr></thead>
                    <tbody>{codes.map(c => { const [label, cls] = CODE_TAG[c.status]; return <tr key={c.id}><td><b>{c.code}</b></td><td>{c.description || '—'}</td><td>{c.unit || '—'}</td><td><span className={`tag ${cls}`}>{label}</span></td></tr> })}</tbody>
                  </table>
                ) : <div className="muted" style={{ fontSize: 13 }}>Bez chybových kódov.</div>}
              </>
            ) : <div className="muted" style={{ fontSize: 13 }}>Bez diagnostiky.</div>}
            <input ref={diagInput} type="file" accept=".pdf,application/pdf,.txt,.csv,.log" hidden
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void act.run(() => actions.uploadDiagnostic(order.id, f)) }} />
          </Blueprint>
        </div>

        <aside className="order-aside order-col">
          <Blueprint className="card" style={{ padding: '16px 18px', gap: 8 }}>
            <span className="card-kicker">Súčet</span>
            <div className="r-line" style={{ fontSize: 13 }}><span>Práca · {t.labor_billing === 'norm' ? `${hoursSk(t.norm_seconds / 3600)} NH` : hm(t.seconds)} × {rate} €/h</span><span>{eur(t.labor)}</span></div>
            {t.labor_billing === 'norm' && <div className="r-line muted" style={{ fontSize: 12 }}><span>Skutočný čas {hm(t.seconds)}</span><span>{eur(t.labor_actual)}</span></div>}
            <div className="r-line" style={{ fontSize: 13 }}><span>Diely · {order.parts_pricing === 'nc' ? 'NC' : 'MOC'} (na reporte)</span><span>{eur(t.parts)}</span></div>
            <div className="r-line muted" style={{ fontSize: 12 }}><span>Diely v MOC</span><span>{eur(t.parts_retail)}</span></div>
            <div className="r-line muted" style={{ fontSize: 12 }}><span>Nákup dielov · NC</span><span>{eur(t.parts_cost)}</span></div>
            <div className="r-line muted" style={{ fontSize: 12 }}><span>Marža na dieloch</span><span>{eur(t.parts - t.parts_cost)}</span></div>
            <div className="r-line" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 8, alignItems: 'baseline' }}>
              <span className="hd" style={{ fontSize: 16 }}>Spolu</span><span className="hd" style={{ fontSize: 26, lineHeight: 1 }}>{eur(t.grand)}</span>
            </div>
          </Blueprint>

          <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
            <span className="card-kicker">Zákazka</span>
            <div className="field"><label htmlFor="od-mech">Mechanik</label>
              <select id="od-mech" className="input" value={order.mechanic?.id ?? ''} disabled={act.busy}
                onChange={e => void act.run(() => actions.updateOrder(order.id, { mechanic_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">— nepriradený —</option>
                {(users.data ?? []).filter(u => u.is_active || u.id === order.mechanic?.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="od-lift">Zdvihák / miesto</label>
              <input id="od-lift" className="input" key={order.lift ?? ''} defaultValue={order.lift ?? ''} placeholder="Zdvihák 1" disabled={act.busy}
                onBlur={e => { const v = e.target.value.trim(); if ((order.lift ?? '') !== v) void act.run(() => actions.updateOrder(order.id, { lift: v || null })) }} />
            </div>
            <div className="field"><label htmlFor="od-summary">Čo treba spraviť</label>
              <input id="od-summary" className="input" key={order.summary} defaultValue={order.summary} disabled={act.busy}
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== order.summary) void act.run(() => actions.updateOrder(order.id, { summary: v })) }} />
            </div>
            <div className="field"><label htmlFor="od-km">Stav tachometra (km)</label>
              <input id="od-km" className="input" type="number" inputMode="numeric" min={0} key={order.car.km} defaultValue={order.car.km || ''} placeholder="napr. 184500" disabled={act.busy}
                onBlur={e => { const v = parseInt(e.target.value, 10) || 0; if (v >= 0 && v !== order.car.km) void act.run(() => actions.updateOrder(order.id, { km: v })) }} />
            </div>
          </Blueprint>

          <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
            <span className="card-kicker">Zákazník</span>
            <div className="field"><label htmlFor="od-cname">Meno</label>
              <input id="od-cname" className="input" key={order.customer.name} defaultValue={order.customer.name} disabled={act.busy}
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== order.customer.name) void act.run(() => actions.updateOrder(order.id, { customer: { name: v } })) }} />
            </div>
            <div className="field"><label htmlFor="od-cphone">Telefón</label>
              <input id="od-cphone" className="input" type="tel" key={order.customer.phone ?? ''} defaultValue={order.customer.phone ?? ''} placeholder="+421 9xx xxx xxx" disabled={act.busy}
                onBlur={e => { const v = e.target.value.trim(); if (v !== (order.customer.phone ?? '')) void act.run(() => actions.updateOrder(order.id, { customer: { phone: v || null } })) }} />
            </div>
            <div className="field"><label htmlFor="od-cemail">Email</label>
              <input id="od-cemail" className="input" type="email" key={order.customer.email ?? ''} defaultValue={order.customer.email ?? ''} placeholder="meno@email.sk" disabled={act.busy}
                onBlur={e => { const v = e.target.value.trim(); if (v !== (order.customer.email ?? '')) void act.run(() => actions.updateOrder(order.id, { customer: { email: v || null } })) }} />
            </div>
            <div className="muted" style={{ fontSize: 11 }}>Zákazník sa ukladá k autu – pri ďalšej návšteve sa podľa ŠPZ/VIN predvyplní.</div>
          </Blueprint>

          <Blueprint className="card" style={{ padding: '16px 18px', gap: 8 }}>
            <span className="card-kicker">Report pre zákazníka</span>
            <a href={publicReportUrl(order.public_token)} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>{publicReportUrl(order.public_token)}</a>
            <ShareReport order={order} primary={false} />
          </Blueprint>
        </aside>
      </div>

      <ManualTimeDialog open={manualOpen} onClose={() => setManualOpen(false)} orderId={order.id} />
      <AddPartDialog open={partOpen} onClose={() => setPartOpen(false)} orderId={order.id} />
      <AddPartDialog open={!!editPart} onClose={() => setEditPart(null)} orderId={order.id} part={editPart ?? undefined} />
      {closeOpen && <CloseOrderDialog order={order} rate={rate} now={now} billing={settings.data?.labor_billing} open onClose={() => setCloseOpen(false)} />}
      <AddCodeDialog open={codeOpen} onClose={() => setCodeOpen(false)} orderId={order.id} />
    </div>
  )
}

function EntryRow({ entry, now }: { entry: WorkEntry; now: number }) {
  const running = !entry.ended_at
  return (
    <div className="entry-row">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          {running && <i className="dot live" />}{firstName(entry.user.name)}{entry.manual ? <span className="tag tag-neutral">ručne</span> : null}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {skDate(dateOf(entry.started_at))} {timeOf(entry.started_at)}{entry.ended_at ? ` – ${timeOf(entry.ended_at)}` : ' – beží'}{entry.note ? ` · ${entry.note}` : ''}
        </div>
      </div>
      <div className="hd num" style={{ whiteSpace: 'nowrap' }}>{running ? hms(entrySeconds(entry, now)) : hm(entry.seconds)}</div>
    </div>
  )
}
