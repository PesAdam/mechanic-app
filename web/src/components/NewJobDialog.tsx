import { useState, type FormEvent } from 'react'
import Dialog from './Dialog'
import { useOrderActions } from '../data/queries'
import VehiclePicker, { EMPTY_VEHICLE, type Stage, type VehicleValue } from './VehiclePicker'
import VehicleLookupResults from './VehicleLookup'
import { ApiError } from '../lib/api'
import type { VehicleMatch, VinInfo } from '../lib/types'

interface Props { open: boolean; onClose: () => void; onCreated?: (id: number) => void }

export default function NewJobDialog({ open, onClose, onCreated }: Props) {
  const { createOrder } = useOrderActions()
  const [plate, setPlate] = useState('')
  const [vin, setVin] = useState('')
  const [vehicle, setVehicle] = useState<VehicleValue>(EMPTY_VEHICLE)
  // Bumped whenever the vehicle is prefilled, so the picker restarts at the right step.
  const [pickerKey, setPickerKey] = useState(0)
  const [pickerStart, setPickerStart] = useState<Stage | undefined>()
  const [carId, setCarId] = useState<number | null>(null)
  const [kmText, setKm] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // VIN wins when typed (it is more specific); the plate otherwise.
  const lookupQ = open ? (vin.trim().length >= 3 ? vin.trim() : plate.trim()) : ''

  const reset = () => { setPlate(''); setVin(''); setVehicle(EMPTY_VEHICLE); setCarId(null); setKm(''); setName(''); setPhone(''); setSummary(''); setError(null); setPickerStart(undefined); setPickerKey(k => k + 1) }

  const useMatch = (m: VehicleMatch) => {
    setCarId(m.car.id)
    setPlate(m.car.plate)
    if (m.car.vin) setVin(m.car.vin)
    setVehicle({ make: m.car.make, model: m.car.model, engine: m.car.engine ?? '', makeId: m.car.car_make_id, modelId: m.car.car_model_id, engineId: m.car.car_engine_id })
    setPickerStart('done')
    setPickerKey(k => k + 1)
    setKm(String(m.car.km))
    setName(m.customer.name)
    setPhone(m.customer.phone ?? '')
  }

  const useVin = (info: VinInfo, model?: VinInfo['models'][number]) => {
    setVehicle({ ...EMPTY_VEHICLE, make: info.make ?? '', makeId: info.car_make_id, model: model?.name ?? '', modelId: model?.car_model_id ?? null })
    // The VIN never tells the engine: continue there (or at the model when only the make is known).
    setPickerStart(model ? 'engine' : 'model')
    setPickerKey(k => k + 1)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const order = await createOrder({
        customer: { name: name.trim(), phone: phone.trim() || undefined },
        car: { id: carId ?? undefined, make: vehicle.make, model: vehicle.model, engine: vehicle.engine || undefined, plate: plate.trim().toUpperCase(), vin: vin.trim().toUpperCase() || undefined, km: parseInt(kmText, 10) || 0 },
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
        <button type="submit" form="new-job" className="btn btn-primary" disabled={busy || !vehicle.make || !vehicle.model}>{busy ? 'Zakladám…' : 'Založiť'}</button>
      </>}
    >
      <form id="new-job" onSubmit={submit}>
        <div className="row">
          <div className="field"><label htmlFor="nj-plate">ŠPZ</label><input id="nj-plate" className="input" value={plate} onChange={e => { setPlate(e.target.value); setCarId(null) }} placeholder="ZA 123 AB" required autoFocus /></div>
          <div className="field"><label htmlFor="nj-vin">VIN</label><input id="nj-vin" className="input" value={vin} onChange={e => { setVin(e.target.value); setCarId(null) }} placeholder="voliteľné" maxLength={17} autoCapitalize="characters" /></div>
        </div>
        <VehicleLookupResults q={lookupQ} picked={vehicle} appliedCarId={carId} onMatch={useMatch} onVin={useVin} />
        {carId && <div className="muted" style={{ fontSize: 11 }}>Auto z histórie: zákazka sa pripojí k tomuto vozidlu a zákazníkovi.</div>}
        <div className="field"><label>Vozidlo</label>
          <VehiclePicker key={pickerKey} value={vehicle} onChange={setVehicle} startAt={pickerStart} />
        </div>
        <div className="muted" style={{ fontSize: 11 }}>Neznáma značka, model alebo motorizácia sa založia do katalógu; normy úkonov sa dajú nastaviť pre ne v Úkonoch.</div>
        <div className="field"><label htmlFor="nj-name">Zákazník</label><input id="nj-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ján Kováč" required /></div>
        <div className="field"><label htmlFor="nj-summary">Čo treba spraviť</label><input id="nj-summary" className="input" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Brzdy vpredu + snímač EGR" required /></div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  )
}
