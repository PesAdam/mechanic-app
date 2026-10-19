import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import Dialog from './Dialog'
import { useUsers } from '../data/queries'
import type { OrderPatch } from '../data/queries'
import { carName, plannedMinutes } from '../lib/calc'
import { dateOf, localToIso, skDateShort, timeOf } from '../lib/format'
import type { Order } from '../lib/types'

export interface PlanDraft { order: Order | null; date: string; time: string }

interface Props {
  draft: PlanDraft
  /** Unplanned orders to choose from when the draft has no order (a click into an empty calendar slot). */
  candidates?: Order[]
  busy: boolean
  /** Hide the link to the desktop detail (the phone has no admin zone). */
  compact?: boolean
  onClose: () => void
  onSave: (order: Order, patch: OrderPatch) => void
}

/** Date, time, duration and mechanic of one order's plan; without an order it first asks which unplanned one to place. */
export default function PlanDialog({ draft, candidates = [], busy, compact = false, onClose, onSave }: Props) {
  const users = useUsers()
  const [orderId, setOrderId] = useState<number | ''>(draft.order?.id ?? '')
  const [date, setDate] = useState(draft.date)
  const [time, setTime] = useState(draft.time)
  const [minutes, setMinutes] = useState(draft.order?.planned_minutes ? String(draft.order.planned_minutes) : '')
  const [mechanic, setMechanic] = useState<number | ''>(draft.order?.mechanic?.id ?? '')
  const order = draft.order ?? candidates.find(o => o.id === orderId) ?? null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!order || !date) return
    const m = parseInt(minutes, 10)
    onSave(order, { planned_at: localToIso(date, time), planned_minutes: m > 0 ? m : null, mechanic_id: mechanic === '' ? null : mechanic })
  }

  return (
    <Dialog open title={draft.order ? `Plán · #${draft.order.number}` : 'Naplánovať zákazku'} onClose={onClose}
      actions={<>
        {draft.order?.planned_at && <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} disabled={busy} onClick={() => onSave(draft.order as Order, { planned_at: null, planned_minutes: null })}>Zrušiť plán</button>}
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Zavrieť</button>
        <button type="submit" form="plan-form" className="btn btn-primary" disabled={busy || !order || !date}>Uložiť</button>
      </>}>
      <form id="plan-form" onSubmit={submit}>
        {draft.order
          ? <div style={{ fontSize: 13 }}><b>{carName(draft.order.car)}</b> · {draft.order.customer.name}<div className="muted" style={{ fontSize: 12 }}>{draft.order.summary}{!compact && <> · <Link to={`/admin/zakazky/${draft.order.id}`}>otvoriť zákazku</Link></>}</div></div>
          : <div className="field"><label htmlFor="pl-order">Zákazka</label>
            <select id="pl-order" className="input" value={orderId} required onChange={e => {
              const id = e.target.value ? Number(e.target.value) : ''
              const picked = candidates.find(o => o.id === id)
              setOrderId(id)
              // Start from what the order already has, so saving the plan never clears its mechanic or duration.
              setMinutes(picked?.planned_minutes ? String(picked.planned_minutes) : '')
              setMechanic(picked?.mechanic?.id ?? '')
            }}>
              <option value="">— vyberte zákazku —</option>
              {candidates.map(o => <option key={o.id} value={o.id}>#{o.number} · {carName(o.car)} · {o.customer.name}</option>)}
            </select>
          </div>}
        <div className="row">
          <div className="field"><label htmlFor="pl-date">Dátum</label><input id="pl-date" className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
          <div className="field"><label htmlFor="pl-time">Čas</label><input id="pl-time" className="input" type="time" step={300} value={time} onChange={e => setTime(e.target.value)} required /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="pl-min">Trvanie (min)</label><input id="pl-min" className="input" type="number" inputMode="numeric" min={5} step={5} value={minutes} onChange={e => setMinutes(e.target.value)} placeholder={order ? `podľa noriem ${plannedMinutes(order)}` : ''} /></div>
          <div className="field"><label htmlFor="pl-mech">Mechanik</label>
            <select id="pl-mech" className="input" value={mechanic} onChange={e => setMechanic(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— nepriradený —</option>
              {(users.data ?? []).filter(u => u.is_active || u.id === order?.mechanic?.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
        {order?.planned_at && <div className="muted" style={{ fontSize: 12 }}>Teraz naplánované na {skDateShort(dateOf(order.planned_at))} {timeOf(order.planned_at)}.</div>}
      </form>
    </Dialog>
  )
}
