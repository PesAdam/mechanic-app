import { useMemo, useState } from 'react'

export type Stage = 'make' | 'model' | 'engine' | 'done'
import { ChevronLeft, Search } from 'lucide-react'
import { useCarMakes } from '../data/queries'
import type { CarEngine, CarMake, CarModel } from '../lib/types'
import MakeLogo from './MakeLogo'
import VehicleLookupResults from './VehicleLookup'
import type { VehicleMatch, VinInfo } from '../lib/types'

export interface VehicleValue {
  make: string; model: string; engine: string
  makeId: number | null; modelId: number | null; engineId: number | null
}
export const EMPTY_VEHICLE: VehicleValue = { make: '', model: '', engine: '', makeId: null, modelId: null, engineId: null }

interface Props {
  value: VehicleValue
  onChange: (v: VehicleValue) => void
  /** Norm form: model and engine are optional ("celá značka" / "všetky motorizácie"). */
  optionalLevels?: boolean
  /** Step to open at when mounted with a prefilled value (remount with a new `key` to apply). */
  startAt?: Stage
  /** The make search also takes a ŠPZ or VIN: known cars from the history and the VIN decode jump straight to the vehicle. */
  lookup?: boolean
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Značka (s logom) → model → motorizácia, each with search; anything not in the catalogue can be typed in. */
export default function VehiclePicker({ value, onChange, optionalLevels = false, startAt, lookup = false }: Props) {
  const makes = useCarMakes()
  const [q, setQ] = useState('')
  // Prefilled from the history or a VIN: a complete value is done, a make alone continues with the model.
  const [stage, setStage] = useState<Stage>(startAt ?? (value.model ? 'done' : value.make ? 'model' : 'make'))
  // Most-worked-on makes first (from the order history), then alphabetically.
  const list = useMemo(() => [...(makes.data ?? [])].sort((a, b) => b.cars_count - a.cars_count || a.name.localeCompare(b.name, 'sk')), [makes.data])
  // A cleared value (e.g. after the form was submitted) always starts over.
  const step: Stage = value.make ? stage : 'make'
  const make = useMemo(() => list.find(m => m.id === value.makeId) ?? null, [list, value.makeId])
  const model = useMemo(() => make?.models.find(m => m.id === value.modelId) ?? null, [make, value.modelId])
  const needle = norm(q.trim())

  const go = (next: Stage) => { setStage(next); setQ('') }
  const pickMake = (m: CarMake | null, name?: string) => { onChange({ ...EMPTY_VEHICLE, make: m?.name ?? (name ?? '').trim(), makeId: m?.id ?? null }); go('model') }
  const wholeMake = () => { onChange({ ...value, model: '', modelId: null, engine: '', engineId: null }); go('done') }
  const pickModel = (m: CarModel | null, name?: string) => { onChange({ ...value, model: m?.name ?? (name ?? '').trim(), modelId: m?.id ?? null, engine: '', engineId: null }); go('engine') }
  const pickEngine = (e: CarEngine | null, name?: string) => { onChange({ ...value, engine: e?.name ?? (name ?? '').trim(), engineId: e?.id ?? null }); go('done') }
  const changeMake = () => { onChange(EMPTY_VEHICLE); go('make') }
  const changeModel = () => { onChange({ ...value, model: '', modelId: null, engine: '', engineId: null }); go('model') }
  const changeEngine = () => { onChange({ ...value, engine: '', engineId: null }); go('engine') }
  const fromHistory = (m: VehicleMatch) => { onChange({ make: m.car.make, model: m.car.model, engine: m.car.engine ?? '', makeId: m.car.car_make_id, modelId: m.car.car_model_id, engineId: m.car.car_engine_id }); go('done') }
  // The VIN never tells the engine: continue there (or at the model when only the make is known).
  const fromVin = (info: VinInfo, model?: VinInfo['models'][number]) => { onChange({ ...EMPTY_VEHICLE, make: info.make ?? '', makeId: info.car_make_id, model: model?.name ?? '', modelId: model?.car_model_id ?? null }); go(model ? 'engine' : 'model') }

  const crumbs = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 28 }}>
      {value.make && (
        <button type="button" className="tag tag-accent" style={{ border: 0, cursor: 'pointer', gap: 6 }} onClick={changeMake} title="Zmeniť značku">
          <MakeLogo name={value.make} url={make?.logo_url} size={16} decorative />{value.make}
        </button>
      )}
      {value.make && step !== 'model' && (
        <button type="button" className={value.model ? 'tag tag-accent' : 'tag tag-neutral'} style={{ border: 0, cursor: 'pointer' }} onClick={changeModel} title="Zmeniť model">{value.model || (optionalLevels ? 'celá značka' : 'model')}</button>
      )}
      {value.make && (step === 'done' || step === 'engine') && value.model && (
        <button type="button" className={value.engine ? 'tag tag-accent' : 'tag tag-neutral'} style={{ border: 0, cursor: 'pointer' }} onClick={changeEngine} title="Zmeniť motorizáciu">{value.engine || (optionalLevels ? 'všetky motorizácie' : 'bez motorizácie')}</button>
      )}
      {!value.make && <span className="muted" style={{ fontSize: 12 }}>Vyberte značku</span>}
    </div>
  )

  if (step === 'done') {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{crumbs}<button type="button" className="btn btn-ghost" style={{ minHeight: 28, fontSize: 12 }} onClick={changeMake}>Zmeniť vozidlo</button></div>
  }

  if (step === 'make') {
    const rows = list.filter(m => !needle || norm(m.name).includes(needle))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {crumbs}
        <SearchBox value={q} onChange={setQ} placeholder={lookup ? 'Značka, ŠPZ alebo VIN…' : 'Hľadať značku…'} />
        {lookup && <VehicleLookupResults q={q} picked={value} onMatch={fromHistory} onVin={fromVin} />}
        <div className="make-grid">
          {rows.map(m => (
            <button key={m.id} type="button" className="make-tile" onClick={() => pickMake(m)}>
              <MakeLogo name={m.name} url={m.logo_url} size={36} decorative /><span>{m.name}</span>
              {m.cars_count > 0 && <span className="make-count">{m.cars_count}×</span>}
            </button>
          ))}
        </div>
        {q.trim() && !rows.some(m => norm(m.name) === needle) && !(lookup && /\d/.test(q)) && (
          <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => pickMake(null, q)}>Použiť „{q.trim()}“ ako novú značku</button>
        )}
        {!list.length && <div className="muted" style={{ fontSize: 12 }}>{makes.isPending ? 'Načítavam značky…' : 'Katalóg je prázdny, napíšte značku do hľadania.'}</div>}
      </div>
    )
  }

  if (step === 'model') {
    const rows = [...(make?.models ?? [])].sort((a, b) => b.cars_count - a.cars_count || a.name.localeCompare(b.name, 'sk')).filter(m => !needle || norm(m.name).includes(needle))
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {crumbs}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-ghost btn-icon" style={{ width: 32, height: 32 }} aria-label="Späť na značky" onClick={changeMake}><ChevronLeft size={16} strokeWidth={1.5} /></button>
          <SearchBox value={q} onChange={setQ} placeholder={`Model ${value.make}…`} autoFocus />
        </div>
        <div className="op-list">
          {optionalLevels && <button type="button" className="op-pick" onClick={wholeMake}><span className="muted">Celá značka {value.make}</span></button>}
          {rows.map(m => <button key={m.id} type="button" className="op-pick" onClick={() => pickModel(m)}><span>{m.name}{m.years && <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>{m.years}</span>}</span><span className="muted" style={{ fontSize: 11 }}>{m.cars_count ? `${m.cars_count}× · ` : ''}{m.engines.length ? `${m.engines.length} motoriz.` : ''}</span></button>)}
          {!rows.length && <div className="muted" style={{ fontSize: 12, padding: 10 }}>Žiadny model v katalógu.</div>}
        </div>
        {q.trim() && !rows.some(m => norm(m.name) === needle) && (
          <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => pickModel(null, q)}>Použiť „{q.trim()}“ ako nový model</button>
        )}
      </div>
    )
  }

  const rows = [...(model?.engines ?? [])].sort((a, b) => b.cars_count - a.cars_count || a.name.localeCompare(b.name, 'sk')).filter(e => !needle || norm(e.name).includes(needle))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {crumbs}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn btn-ghost btn-icon" style={{ width: 32, height: 32 }} aria-label="Späť na modely" onClick={changeModel}><ChevronLeft size={16} strokeWidth={1.5} /></button>
        <SearchBox value={q} onChange={setQ} placeholder="Motorizácia, napr. 2.0 TDI…" autoFocus />
      </div>
      <div className="op-list">
        <button type="button" className="op-pick" onClick={() => pickEngine(null, '')}><span className="muted">{optionalLevels ? 'Všetky motorizácie' : 'Bez motorizácie'}</span></button>
        {rows.map(e => <button key={e.id} type="button" className="op-pick" onClick={() => pickEngine(e)}><span>{e.name}</span>{e.cars_count > 0 && <span className="muted" style={{ fontSize: 11 }}>{e.cars_count}×</span>}</button>)}
      </div>
      {q.trim() && !rows.some(e => norm(e.name) === needle) && (
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => pickEngine(null, q)}>Použiť „{q.trim()}“ ako novú motorizáciu</button>
      )}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <Search size={14} strokeWidth={1.5} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-neutral-600)' }} />
      <input className="input" style={{ paddingLeft: 30 }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder} />
    </div>
  )
}
