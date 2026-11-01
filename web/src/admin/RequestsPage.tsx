import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check, Copy, UserPlus, X } from 'lucide-react'
import { useInvites, useRequestActions, useServiceRequests } from '../data/queries'
import { useAction } from '../lib/useAction'
import { dateOf, km, skDate, timeOf } from '../lib/format'
import { copyText } from '../lib/share'
import { plural } from '../lib/text'
import type { ClientInvite, ServiceRequest } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'
import Dialog from '../components/Dialog'
import StatusTag from '../components/StatusTag'

type Tab = 'new' | 'handled'
const INVITE_STATE: Record<ClientInvite['state'], [string, string]> = {
  open: ['Čaká na registráciu', 'tag-outline'], used: ['Použitá', 'tag-neutral'], revoked: ['Zrušená', 'tag-neutral'], expired: ['Vypršala', 'tag-neutral'],
}

/** Požiadavky — what invited people sent from their portal. Nothing enters the orders until "Vytvoriť zákazku". */
export default function RequestsPage() {
  const requests = useServiceRequests()
  const actions = useRequestActions()
  const act = useAction()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('new')
  const [rejecting, setRejecting] = useState<ServiceRequest | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const list = requests.data ?? []
  const fresh = list.filter(r => r.status === 'new')
  const shown = tab === 'new' ? fresh : list.filter(r => r.status !== 'new')
  const accept = (r: ServiceRequest) => void act.run(async () => nav(`/admin/zakazky/${await actions.accept(r.id)}`))

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><div className="kicker">{fresh.length} {plural(fresh.length, 'nová', 'nové', 'nových')}</div><h1>Požiadavky</h1></div>
        <div className="admin-actions">
          <div className="seg">
            <label className="seg-opt" style={{ minHeight: 36 }}><input type="radio" name="rq-tab" checked={tab === 'new'} onChange={() => setTab('new')} />Nové</label>
            <label className="seg-opt" style={{ minHeight: 36 }}><input type="radio" name="rq-tab" checked={tab === 'handled'} onChange={() => setTab('handled')} />Vybavené</label>
          </div>
          <button type="button" className="btn btn-primary blueprint" style={{ minHeight: 36 }} onClick={() => setInviteOpen(true)}><Corners /><UserPlus size={16} strokeWidth={1.5} />Pozvať človeka</button>
        </div>
      </div>

      {act.error && <div className="form-error" role="alert">{act.error}</div>}
      <div className="req-grid">
        {shown.map(r => <RequestCard key={r.id} r={r} busy={act.busy} onAccept={() => accept(r)} onReject={() => setRejecting(r)} />)}
        {!shown.length && (
          <Blueprint style={{ padding: 16 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              {requests.isPending ? 'Načítavam…' : tab === 'new' ? 'Žiadne nové požiadavky. Ľudí pozveš tlačidlom „Pozvať človeka“ – dostanú jednorazový odkaz na registráciu.' : 'Zatiaľ nič vybavené.'}
            </div>
          </Blueprint>
        )}
      </div>

      <AccessSection />
      <RejectDialog request={rejecting} onClose={() => setRejecting(null)} />
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  )
}

function RequestCard({ r, busy, onAccept, onReject }: { r: ServiceRequest; busy: boolean; onAccept: () => void; onReject: () => void }) {
  const facts = [r.km ? km(r.km) : null, r.vin ? `VIN ${r.vin}` : null, r.preferred_date ? `chce prísť ${skDate(r.preferred_date)}` : null].filter(Boolean)
  return (
    <Blueprint className="card" style={{ padding: '14px 16px', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="card-title">{r.plate} · {r.make} {r.model}{r.engine ? ` ${r.engine}` : ''}</span>
        <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{skDate(dateOf(r.created_at))} {timeOf(r.created_at)}</span>
      </div>
      <div style={{ fontSize: 13 }}>
        <b>{r.client.name}</b> · <a href={`tel:${r.client.phone.replace(/\s+/g, '')}`}>{r.client.phone}</a> · <a href={`mailto:${r.client.email}`}>{r.client.email}</a>
      </div>
      <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{r.description}</div>
      {facts.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{facts.join(' · ')}</div>}
      {r.photos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {r.photos.map((src, i) => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Fotka ${i + 1} od ${r.client.name}`} style={{ width: 72, height: 72, objectFit: 'cover', display: 'block' }} /></a>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        {r.status === 'new' && <>
          <button type="button" className="btn btn-primary blueprint" disabled={busy} onClick={onAccept}><Corners /><Check size={16} strokeWidth={1.5} />Vytvoriť zákazku</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onReject}><X size={16} strokeWidth={1.5} />Zamietnuť</button>
        </>}
        {r.status === 'accepted' && (r.order
          ? <><Link to={`/admin/zakazky/${r.order.id}`}>Zákazka #{r.order.number} →</Link><StatusTag status={r.order.status} /></>
          : <span className="muted" style={{ fontSize: 13 }}>Prijatá, zákazka už neexistuje.</span>)}
        {r.status === 'rejected' && <span className="muted" style={{ fontSize: 13 }}>Zamietnutá{r.reject_reason ? `: ${r.reject_reason}` : ''}</span>}
      </div>
    </Blueprint>
  )
}

function RejectDialog({ request, onClose }: { request: ServiceRequest | null; onClose: () => void }) {
  const { reject } = useRequestActions()
  const act = useAction()
  const [reason, setReason] = useState('')
  const close = () => { setReason(''); act.clear(); onClose() }
  const submit = () => request && void act.run(async () => { await reject(request.id, reason.trim() || null); close() })
  return (
    <Dialog open={!!request} title={`Zamietnuť požiadavku${request ? ` · ${request.plate}` : ''}`} onClose={close}
      actions={<>
        <button type="button" className="btn btn-secondary" onClick={close} disabled={act.busy}>Späť</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={act.busy}>Zamietnuť</button>
      </>}>
      <div className="field">
        <label htmlFor="rq-reason">Dôvod (uvidí ho {request?.client.name ?? 'odosielateľ'}, nepovinné)</label>
        <textarea id="rq-reason" className="input" value={reason} onChange={e => setReason(e.target.value)} maxLength={255} placeholder="Napr. na toto nemáme náradie, skúste…" />
      </div>
      {act.error && <div className="form-error" role="alert">{act.error}</div>}
    </Dialog>
  )
}

/** A one-time link. It is shown here once: only its hash is kept, so a lost link means making a new one. */
function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createInvite } = useRequestActions()
  const act = useAction()
  const [note, setNote] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const close = () => { setNote(''); setLink(null); setCopied(false); act.clear(); onClose() }
  const create = () => void act.run(async () => {
    const { token } = await createInvite(note.trim() || null)
    setLink(`${window.location.origin}/pozvanka/${token}`)
  })
  const copy = async () => { if (link && (await copyText(link))) setCopied(true) }

  return (
    <Dialog open={open} title="Pozvať človeka" onClose={close}
      actions={link
        ? <button type="button" className="btn btn-primary" onClick={close}>Hotovo</button>
        : <>
          <button type="button" className="btn btn-secondary" onClick={close} disabled={act.busy}>Zrušiť</button>
          <button type="button" className="btn btn-primary" onClick={create} disabled={act.busy}>Vytvoriť odkaz</button>
        </>}>
      {link ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" readOnly value={link} aria-label="Odkaz na registráciu" onFocus={e => e.target.select()} />
            <button type="button" className="btn btn-secondary" onClick={() => void copy()}><Copy size={16} strokeWidth={1.5} />{copied ? 'Skopírované ✓' : 'Kopírovať'}</button>
          </div>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Pošli ho SMS-kou alebo správou. Zaregistruje sa cez neho len jeden človek a platí 7 dní. Po zatvorení tohto okna ho už znova neuvidíš –
            ak sa stratí, vytvor nový (starý môžeš zrušiť nižšie v Prístupe).
          </div>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="inv-note">Pre koho (vidíš len ty, nepovinné)</label>
          <input id="inv-note" className="input" value={note} onChange={e => setNote(e.target.value)} maxLength={120} placeholder="Napr. Peter – autobazár Hôrky" autoFocus />
        </div>
      )}
      {act.error && <div className="form-error" role="alert">{act.error}</div>}
    </Dialog>
  )
}

/** Who can send requests, and the links still waiting for someone. */
function AccessSection() {
  const invites = useInvites()
  const { revokeInvite, setClientActive } = useRequestActions()
  const act = useAction()
  const clients = invites.data?.clients ?? []
  const pending = (invites.data?.invites ?? []).filter(i => i.state !== 'used')

  return (
    <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 16px 0', gap: 8 }}>
        <span className="card-title">Prístup</span>
        <span className="card-meta">Títo ľudia vidia len svoje požiadavky – nič z tvojich zákaziek, čísel ani nastavení.</span>
      </div>
      {act.error && <div className="form-error" role="alert" style={{ margin: '8px 16px 0' }}>{act.error}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ marginTop: 6 }}>
          <thead><tr><th>Meno</th><th>E-mail</th><th>Telefón</th><th>Požiadavky</th><th>Od</th><th></th></tr></thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} style={c.is_active ? undefined : { opacity: 0.55 }}>
                <td><b>{c.name}</b>{!c.is_active && <span className="muted"> · zablokovaný</span>}</td>
                <td>{c.email}</td>
                <td className="nowrap">{c.phone}</td>
                <td>{c.requests_count}</td>
                <td className="nowrap">{skDate(dateOf(c.created_at))}</td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="linkbtn" disabled={act.busy}
                    onClick={() => { if (c.is_active ? window.confirm(`Zablokovať ${c.name}? Hneď sa odhlási a nebude môcť posielať požiadavky.`) : true) void act.run(() => setClientActive(c.id, !c.is_active)) }}>
                    {c.is_active ? 'Zablokovať' : 'Povoliť'}
                  </button>
                </td>
              </tr>
            ))}
            {pending.map(i => (
              <tr key={`i${i.id}`}>
                <td><span className="muted">Pozvánka</span>{i.note ? ` · ${i.note}` : ''}</td>
                <td colSpan={3}><span className={`tag ${INVITE_STATE[i.state][1]}`}>{INVITE_STATE[i.state][0]}</span></td>
                <td className="nowrap muted">{i.state === 'open' ? `do ${skDate(dateOf(i.expires_at))}` : skDate(dateOf(i.created_at))}</td>
                <td style={{ textAlign: 'right' }}>
                  {i.state === 'open' && <button type="button" className="linkbtn" disabled={act.busy} onClick={() => void act.run(() => revokeInvite(i.id))}>Zrušiť</button>}
                </td>
              </tr>
            ))}
            {!clients.length && !pending.length && <tr><td colSpan={6} className="muted">{invites.isPending ? 'Načítavam…' : 'Zatiaľ nikto. Pozvi prvého človeka tlačidlom hore.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </Blueprint>
  )
}
