import { useState, type FormEvent } from 'react'
import Dialog from './Dialog'
import { useOrderActions, useUsers } from '../data/queries'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'
import type { CodeStatus, Part } from '../lib/types'

interface Base { open: boolean; onClose: () => void; orderId: number }

function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wrap = async (fn: () => Promise<unknown>, onDone: () => void) => {
    setBusy(true)
    setError(null)
    try { await fn(); onDone() } catch (err) { setError(err instanceof ApiError ? err.message : 'Nepodarilo sa uložiť.') } finally { setBusy(false) }
  }
  return { busy, error, wrap }
}

/** "Ručne": a time entry typed in instead of clocked, always with an author. */
export function ManualTimeDialog({ open, onClose, orderId }: Base) {
  const { user } = useAuth()
  const users = useUsers()
  const { addManual } = useOrderActions()
  const { busy, error, wrap } = useSubmit()
  const [minutes, setMinutes] = useState('15')
  const [note, setNote] = useState('')
  const [mech, setMech] = useState<number | null>(null)
  const mechanicId = mech ?? user?.id ?? 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const m = parseInt(minutes, 10)
    if (!m || m <= 0) return
    void wrap(() => addManual(orderId, { minutes: m, note: note.trim(), user_id: mechanicId }), () => { setMinutes('15'); setNote(''); onClose() })
  }

  return (
    <Dialog open={open} title="Ručný zápis času" onClose={onClose}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Zrušiť</button><button type="submit" form="manual-time" className="btn btn-primary" disabled={busy}>Zapísať</button></>}>
      <form id="manual-time" onSubmit={submit}>
        <div className="row">
          <div className="field"><label htmlFor="mt-min">Minúty</label><input id="mt-min" className="input" inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} min={1} max={1440} step={5} type="number" required autoFocus /></div>
          <div className="field"><label htmlFor="mt-mech">Mechanik</label>
            <select id="mt-mech" className="input" value={mechanicId} onChange={e => setMech(Number(e.target.value))}>
              {(users.data?.filter(u => u.is_active) ?? (user ? [user] : [])).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label htmlFor="mt-note">Čo sa robilo</label><input id="mt-note" className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Skúšobná jazda, kontrola brzdného účinku" /></div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  )
}

export function AddPartDialog({ open, onClose, orderId, part }: Base & { part?: Part }) {
  const { addPart, updatePart } = useOrderActions()
  const { busy, error, wrap } = useSubmit()
  const [name, setName] = useState('')
  const [meta, setMeta] = useState('')
  const [price, setPrice] = useState('')
  const [purchase, setPurchase] = useState('')
  const [seeded, setSeeded] = useState<number | 'new' | null>(null)

  // Re-seed when a different part (or the "new" form) is opened.
  const key = part?.id ?? 'new'
  if (open && seeded !== key) {
    setSeeded(key)
    setName(part?.name ?? '')
    setMeta(part?.meta ?? '')
    setPrice(part ? String(part.price).replace('.', ',') : '')
    setPurchase(part?.purchase_price != null ? String(part.purchase_price).replace('.', ',') : '')
  }
  if (!open && seeded !== null) setSeeded(null)

  const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isNaN(n) ? null : n }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const moc = num(price)
    if (!name.trim() || moc === null) return
    const nc = purchase.trim() ? num(purchase) : null
    const body = { name: name.trim(), meta: meta.trim(), price: moc, purchase_price: nc }
    void wrap(() => (part ? updatePart(part.id, body) : addPart(orderId, body)), () => { setName(''); setMeta(''); setPrice(''); setPurchase(''); onClose() })
  }

  return (
    <Dialog open={open} title={part ? 'Upraviť diel' : 'Pridať diel'} onClose={onClose}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Zrušiť</button><button type="submit" form="add-part" className="btn btn-primary" disabled={busy}>{part ? 'Uložiť' : 'Pridať'}</button></>}>
      <form id="add-part" onSubmit={submit}>
        <div className="field"><label htmlFor="ap-name">Názov</label><input id="ap-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Brzdové kotúče ATE 312 mm" required autoFocus /></div>
        <div className="field"><label htmlFor="ap-meta">Množstvo · kód</label><input id="ap-meta" className="input" value={meta} onChange={e => setMeta(e.target.value)} placeholder="2 ks · 24.0112-0150.1" /></div>
        <div className="row">
          <div className="field"><label htmlFor="ap-price">MOC – predajná cena (€)</label><input id="ap-price" className="input" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="89,90" required /></div>
          <div className="field"><label htmlFor="ap-purchase">NC – nákupná cena (€)</label><input id="ap-purchase" className="input" inputMode="decimal" value={purchase} onChange={e => setPurchase(e.target.value)} placeholder="voliteľné" /></div>
        </div>
        <div className="muted" style={{ fontSize: 11 }}>Na doklad pre zákazníka ide vždy MOC. NC slúži na výpočet marže v Prehľade.</div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  )
}

export function AddCodeDialog({ open, onClose, orderId }: Base) {
  const { addCode } = useOrderActions()
  const { busy, error, wrap } = useSubmit()
  const [code, setCode] = useState('')
  const [desc, setDesc] = useState('')
  const [unit, setUnit] = useState('Motor · 01')
  const [status, setStatus] = useState<CodeStatus>('open')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    void wrap(() => addCode(orderId, { code: code.trim().toUpperCase(), description: desc.trim(), unit: unit.trim(), status }), () => { setCode(''); setDesc(''); onClose() })
  }

  return (
    <Dialog open={open} title="Chybový kód" onClose={onClose}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Zrušiť</button><button type="submit" form="add-code" className="btn btn-primary" disabled={busy}>Pridať</button></>}>
      <form id="add-code" onSubmit={submit}>
        <div className="row">
          <div className="field"><label htmlFor="ac-code">Kód</label><input id="ac-code" className="input" value={code} onChange={e => setCode(e.target.value)} placeholder="P0401" required autoFocus /></div>
          <div className="field"><label htmlFor="ac-unit">Riadiaca jednotka</label><input id="ac-unit" className="input" value={unit} onChange={e => setUnit(e.target.value)} /></div>
        </div>
        <div className="field"><label htmlFor="ac-desc">Popis</label><input id="ac-desc" className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Nedostatočný prietok EGR" /></div>
        <div className="field"><label htmlFor="ac-status">Stav</label>
          <select id="ac-status" className="input" value={status} onChange={e => setStatus(e.target.value as CodeStatus)}>
            <option value="open">Otvorené</option><option value="fixed">Odstránené</option><option value="watch">Sledovať</option>
          </select>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  )
}
