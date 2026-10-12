import { useEffect, useState } from 'react'
import { useVehicleLookup } from '../data/queries'
import MakeLogo from './MakeLogo'
import { carName } from '../lib/calc'
import { dateOf, skDateShort } from '../lib/format'
import { plural } from '../lib/text'
import type { VehicleMatch, VinInfo } from '../lib/types'
import type { VehicleValue } from './VehiclePicker'

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

interface Props {
  /** Raw text typed by the user (ŠPZ or VIN); debounced and sent to `GET vehicles/lookup`. */
  q: string
  picked: VehicleValue
  /** A car already applied from the history: hidden from the matches, and the VIN hint is pointless then. */
  appliedCarId?: number | null
  onMatch: (m: VehicleMatch) => void
  onVin: (info: VinInfo, model?: VinInfo['models'][number]) => void
}

/** Cards for what the ŠPZ/VIN says: known cars from the shop's history, then the offline VIN decode. */
export default function VehicleLookupResults({ q, picked, appliedCarId = null, onMatch, onVin }: Props) {
  const debounced = useDebounced(q.trim(), 350)
  const lookup = useVehicleLookup(debounced)
  if (debounced.replace(/[\s-]+/g, '').length < 3) return null
  const matches = (lookup.data?.matches ?? []).filter(m => m.car.id !== appliedCarId)
  const vinInfo = appliedCarId ? null : lookup.data?.vin ?? null
  if (!matches.length && !vinInfo) return null
  return (
    <div className="lookup" aria-live="polite">
      {matches.slice(0, 3).map(m => (
        <div key={m.car.id} className="lookup-card">
          <MakeLogo name={m.car.make} url={m.car.logo_url} size={28} decorative />
          <div className="lookup-main">
            <b>{carName(m.car)} · {m.car.plate}</b>
            <span className="muted">
              {m.customer.name}{m.customer.phone ? ` · ${m.customer.phone}` : ''} · {m.orders_count} {plural(m.orders_count, 'zákazka', 'zákazky', 'zákaziek')}
              {m.last_order?.received_at ? `, naposledy ${skDateShort(dateOf(m.last_order.received_at))}` : ''}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => onMatch(m)}>Použiť</button>
        </div>
      ))}
      {vinInfo && <VinHint info={vinInfo} picked={picked} onPick={onVin} />}
    </div>
  )
}

/** What the VIN itself says: make, model year and (for covered makers) the generation. */
function VinHint({ info, picked, onPick }: { info: VinInfo; picked: VehicleValue; onPick: Props['onVin'] }) {
  if (!info.valid) return <div className="muted" style={{ fontSize: 11 }}>VIN má 17 znakov bez I, O a Q.</div>
  if (!info.make) return <div className="muted" style={{ fontSize: 11 }}>VIN: výrobcu sa nepodarilo rozpoznať, vozidlo vyberte ručne.</div>
  const year = info.year ? ` · r. v. ${info.year}` : ''
  const applied = picked.make === info.make && (info.models.length !== 1 || picked.model === info.models[0].name)
  return (
    <div className="lookup-card">
      <MakeLogo name={info.make} url={info.logo_url} size={28} decorative />
      <div className="lookup-main">
        <b>VIN: {info.make}{info.models.length === 1 ? ` ${info.models[0].name}` : ''}{year}</b>
        <span className="muted">
          {info.models.length === 1 && info.models[0].years ? `Generácia ${info.models[0].years}. ` : ''}
          {info.models.length > 1 ? 'Kód modelu zdieľa viac typov, vyberte: ' : info.models.length === 0 ? 'Model z VIN tejto značky nevieme určiť. ' : ''}
          Orientačne, skontrolujte.
        </span>
        {info.models.length > 1 && (
          <div className="lookup-actions">
            {info.models.map(m => <button key={m.name} type="button" className={picked.model === m.name ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => onPick(info, m)}>{m.name}{m.years ? ` (${m.years})` : ''}</button>)}
          </div>
        )}
      </div>
      {info.models.length <= 1 && !applied && (
        <button type="button" className="btn btn-primary" onClick={() => onPick(info, info.models[0])}>{info.models.length ? 'Použiť' : 'Použiť značku'}</button>
      )}
    </div>
  )
}
