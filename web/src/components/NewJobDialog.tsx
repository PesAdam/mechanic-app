import { useState, type FormEvent } from 'react'
import Dialog from './Dialog'
import { useOrderActions } from '../data/queries'
import { ApiError } from '../lib/api'

interface Props { open: boolean; onClose: () => void; onCreated?: (id: number) => void }

export default function NewJobDialog({ open, onClose, onCreated }: Props) {
  const { createOrder } = useOrderActions()
  const [plate, setPlate] = useState('')
  const [vin, setVin] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [kmText, setKm] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => { setPlate(''); setVin(''); setMake(''); setModel(''); setKm(''); setName(''); setPhone(''); setSummary(''); setError(null) }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const order = await createOrder({
        customer: { name: name.trim(), phone: phone.trim() || undefined },
        car: { make: make.trim(), model: model.trim(), plate: plate.trim().toUpperCase(), vin: vin.trim().toUpperCase() || undefined, km: parseInt(kmText, 10) || 0 },
        summary: summary.trim(),
      })
      reset()
      onClose()
      onCreated?.(order.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Zákazku sa nepodarilo založiť.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open} title="Nová zákazka" onClose={onClose}
      actions={<>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Zrušiť</button>
        <button type="submit" form="new-job" className="btn btn-primary" disabled={busy}>{busy ? 'Zakladám…' : 'Založiť'}</button>
      </>}
    >
      <form id="new-job" onSubmit={submit}>
        <div className="row">
          <div className="field"><label htmlFor="nj-plate">ŠPZ</label><input id="nj-plate" className="input" value={plate} onChange={e => setPlate(e.target.value)} placeholder="ZA 123 AB" required autoFocus /></div>
          <div className="field"><label htmlFor="nj-vin">VIN</label><input id="nj-vin" className="input" value={vin} onChange={e => setVin(e.target.value)} placeholder="voliteľné" maxLength={17} /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="nj-make">Značka</label><input id="nj-make" className="input" value={make} onChange={e => setMake(e.target.value)} placeholder="Škoda" required /></div>
          <div className="field"><label htmlFor="nj-model">Model</label><input id="nj-model" className="input" value={model} onChange={e => setModel(e.target.value)} placeholder="Octavia III 2.0 TDI" required /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="nj-km">Stav km</label><input id="nj-km" className="input" inputMode="numeric" value={kmText} onChange={e => setKm(e.target.value)} placeholder="184230" /></div>
          <div className="field"><label htmlFor="nj-phone">Telefón</label><input id="nj-phone" className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+421 …" /></div>
        </div>
        <div className="field"><label htmlFor="nj-name">Zákazník</label><input id="nj-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ján Kováč" required /></div>
        <div className="field"><label htmlFor="nj-summary">Čo treba spraviť</label><input id="nj-summary" className="input" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Brzdy vpredu + snímač EGR" required /></div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  )
}
