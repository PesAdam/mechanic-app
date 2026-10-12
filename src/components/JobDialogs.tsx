import { useState, type FormEvent } from 'react'
import Dialog from './Dialog'
import { useWorkshop } from '../store/workshop'
import type { CodeStatus } from '../lib/types'

interface Base { open: boolean; onClose: () => void; jobId: string }

/** "Ručne": a time entry typed in instead of clocked, always with an author. */
export function ManualTimeDialog({ open, onClose, jobId }: Base) {
  const { state, dispatch } = useWorkshop()
  const [minutes, setMinutes] = useState('15')
  const [note, setNote] = useState('')
  const [mech, setMech] = useState(state.currentMechanicId)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const m = parseInt(minutes, 10)
    if (!m || m <= 0) return
    dispatch({ type: 'addManual', jobId, minutes: m, note: note.trim(), mechanicId: mech })
    setMinutes('15'); setNote('')
    onClose()
  }
  return (
    <Dialog open={open} title="Ručný zápis času" onClose={onClose}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose}>Zrušiť</button><button type="submit" form="manual-time" className="btn btn-primary">Zapísať</button></>}>
      <form id="manual-time" onSubmit={submit}>
        <div className="row">
          <div className="field"><label htmlFor="mt-min">Minúty</label><input id="mt-min" className="input" inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} min={1} step={5} type="number" required autoFocus /></div>
          <div className="field"><label htmlFor="mt-mech">Mechanik</label>
            <select id="mt-mech" className="input" value={mech} onChange={e => setMech(e.target.value)}>
              {state.mechanics.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label htmlFor="mt-note">Čo sa robilo</label><input id="mt-note" className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Skúšobná jazda, kontrola brzdného účinku" /></div>
      </form>
    </Dialog>
  )
}

export function AddPartDialog({ open, onClose, jobId }: Base) {
  const { dispatch } = useWorkshop()
  const [name, setName] = useState('')
  const [meta, setMeta] = useState('')
  const [price, setPrice] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const p = parseFloat(price.replace(',', '.'))
    if (!name.trim() || Number.isNaN(p)) return
    dispatch({ type: 'addPart', jobId, part: { name: name.trim(), meta: meta.trim(), price: p } })
    setName(''); setMeta(''); setPrice('')
    onClose()
  }
  return (
    <Dialog open={open} title="Pridať diel" onClose={onClose}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose}>Zrušiť</button><button type="submit" form="add-part" className="btn btn-primary">Pridať</button></>}>
      <form id="add-part" onSubmit={submit}>
        <div className="field"><label htmlFor="ap-name">Názov</label><input id="ap-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Brzdové kotúče ATE 312 mm" required autoFocus /></div>
        <div className="row">
          <div className="field"><label htmlFor="ap-meta">Množstvo · kód</label><input id="ap-meta" className="input" value={meta} onChange={e => setMeta(e.target.value)} placeholder="2 ks · 24.0112-0150.1" /></div>
          <div className="field"><label htmlFor="ap-price">Cena (€)</label><input id="ap-price" className="input" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="89,90" required /></div>
        </div>
      </form>
    </Dialog>
  )
}

export function AddCodeDialog({ open, onClose, jobId }: Base) {
  const { dispatch } = useWorkshop()
  const [code, setCode] = useState('')
  const [desc, setDesc] = useState('')
  const [unit, setUnit] = useState('Motor · 01')
  const [status, setStatus] = useState<CodeStatus>('open')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    dispatch({ type: 'addCode', jobId, code: { code: code.trim().toUpperCase(), desc: desc.trim(), unit: unit.trim(), status } })
    setCode(''); setDesc('')
    onClose()
  }
  return (
    <Dialog open={open} title="Chybový kód" onClose={onClose}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose}>Zrušiť</button><button type="submit" form="add-code" className="btn btn-primary">Pridať</button></>}>
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
      </form>
    </Dialog>
  )
}
