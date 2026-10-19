import { useEffect, useState, type FormEvent } from 'react'
import { Car, Pencil, Plus, X } from 'lucide-react'
import { useCarActions, useOperationActions, useOperations, type OperationPayload } from '../data/queries'
import { ApiError } from '../lib/api'
import { hm } from '../lib/format'
import type { Operation } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'
import Dialog from '../components/Dialog'
import { OPERATION_CATEGORIES, categoryLabel, categoryOrder } from '../lib/categories'
import VehiclePicker, { EMPTY_VEHICLE, type VehicleValue } from '../components/VehiclePicker'

const CATEGORIES = OPERATION_CATEGORIES.map(([k]) => k)
const VEHICLE_KEY = 'mechanic-app:ukony-vehicle'
const SOURCE_LABEL = { engine: 'motorizácia', model: 'model', make: 'značka', default: 'všeobecná' } as const

const readVehicle = (): VehicleValue => {
  try { const raw = localStorage.getItem(VEHICLE_KEY); return raw ? { ...EMPTY_VEHICLE, ...(JSON.parse(raw) as VehicleValue) } : EMPTY_VEHICLE } catch { return EMPTY_VEHICLE }
}

/** Úkony: pick the vehicle first (most-worked makes on top), then see and tune the norms that apply to it. */
export default function OperationsPage() {
  const [vehicle, setVehicle] = useState<VehicleValue>(readVehicle)
  useEffect(() => { try { localStorage.setItem(VEHICLE_KEY, JSON.stringify(vehicle)) } catch { /* ignore */ } }, [vehicle])
  // Only catalogue vehicles can carry norms; a typed-in name without an id falls back to the general list.
  const makeId = vehicle.makeId
  const modelId = vehicle.modelId
  const engineId = vehicle.engineId
  const hasVehicle = !!makeId
  const catalog = useOperations(modelId, engineId, modelId ? null : makeId)
  const { addNorm, removeNorm } = useOperationActions()
  const { importDefaults } = useCarActions()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [editing, setEditing] = useState<Operation | null>(null)
  const [creating, setCreating] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [editingNorm, setEditingNorm] = useState<{ id: number; minutes: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const rows = [...(catalog.data ?? [])]
    .filter(o => (showInactive || o.is_active) && (!category || o.category === category) && (!q || o.name.toLowerCase().includes(q) || categoryLabel(o.category).toLowerCase().includes(q)))
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.name.localeCompare(b.name, 'sk'))
  const vehicleLabel = [vehicle.make, vehicle.model, vehicle.engine].filter(Boolean).join(' ')
  const level: 'engine' | 'model' | 'make' = engineId ? 'engine' : modelId ? 'model' : 'make'

  const saveNorm = async (op: Operation) => {
    const m = parseInt(editingNorm?.minutes ?? '', 10)
    if (!makeId || !m || m <= 0) return
    setBusy(true); setError(null)
    try { await addNorm(op.id, { car_make_id: makeId, car_model_id: modelId, car_engine_id: engineId, norm_minutes: m }); setEditingNorm(null) } catch (e) { setError(e instanceof ApiError ? e.message : 'Nepodarilo sa uložiť normu.') } finally { setBusy(false) }
  }
  const dropNorm = async (normId: number) => {
    setBusy(true); setError(null)
    try { await removeNorm(normId) } catch (e) { setError(e instanceof ApiError ? e.message : 'Nepodarilo sa odstrániť normu.') } finally { setBusy(false) }
  }

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><div className="kicker">Normohodiny</div><h1>Úkony</h1></div>
        <div className="admin-actions">
          <select className="input" style={{ width: 190, minHeight: 36 }} value={category} onChange={e => setCategory(e.target.value)} aria-label="Kategória">
            <option value="">Všetky kategórie</option>
            {OPERATION_CATEGORIES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input className="input" style={{ width: 220, minHeight: 36 }} placeholder="Hľadať úkon…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Hľadať" />
          <label className="radio" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ position: 'static', opacity: 1, width: 14, height: 14, pointerEvents: 'auto' }} />aj neaktívne</label>
          <button className="btn btn-secondary" style={{ minHeight: 36 }} disabled={importing === '…'} title="Doplní bežné značky, modely a motorizácie do katalógu vozidiel"
            onClick={() => { setImporting('…'); importDefaults().then(n => setImporting(`${n} značiek doplnených ✓`)).catch(() => setImporting('Nepodarilo sa doplniť katalóg.')).finally(() => setTimeout(() => setImporting(null), 3000)) }}>
            <Car size={16} strokeWidth={1.5} />{importing ?? 'Doplniť katalóg vozidiel'}
          </button>
          <button className="btn btn-primary blueprint" style={{ minHeight: 36 }} onClick={() => setCreating(true)}><Corners /><Plus size={16} strokeWidth={1.5} />Pridať úkon</button>
        </div>
      </div>

      <Blueprint className="card" style={{ padding: '16px 18px', gap: 10 }}>
        <div className="sec-head" style={{ marginBottom: 0 }}>
          <span className="card-title">Vozidlo</span>
          <span className="muted" style={{ fontSize: 12 }}>značky podľa toho, na ktorých robíte najviac · alebo napíšte ŠPZ / VIN auta</span>
        </div>
        <VehiclePicker value={vehicle} onChange={setVehicle} optionalLevels lookup />
        {vehicle.make && !makeId && <div className="form-error">„{vehicle.make}“ ešte nie je v katalógu, normy preň pôjdu nastaviť po prvej zákazke s týmto autom. Zatiaľ sa ukazujú všeobecné normy.</div>}
      </Blueprint>

      <div className="muted" style={{ fontSize: 13, maxWidth: 800 }}>
        {hasVehicle
          ? <>Časy pre <b>{vehicleLabel}</b>. Pri každom úkone vidíš, z akej úrovne norma pochádza (motorizácia → model → značka → všeobecná); kliknutím na ceruzku pri norme ju nastavíš priamo pre {level === 'engine' ? 'túto motorizáciu' : level === 'model' ? 'tento model' : 'celú značku'}. „Tvoj priemer“ je z uzavretých zákaziek na tomto vozidle.</>
          : <>Vyberte vozidlo a tabuľka ukáže normy, ktoré preň platia. Bez vozidla vidíte všeobecné normy. Východiskové hodnoty sú orientačné, prepíš ich normami od dodávateľa dielov alebo z Autodata / TecRMI.</>}
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}

      <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              {hasVehicle
                ? <tr><th>Úkon</th><th>Kategória</th><th>Norma pre vozidlo</th><th>Všeobecná</th><th>Tvoj priemer na vozidle</th><th>Rozdiel</th><th></th></tr>
                : <tr><th>Úkon</th><th>Kategória</th><th>Norma</th><th>Podľa vozidla</th><th>Tvoj priemer</th><th>Rozdiel</th><th></th></tr>}
            </thead>
            <tbody>
              {rows.map(o => {
                const normMin = hasVehicle ? (o.car_norm_minutes ?? o.norm_minutes) : o.norm_minutes
                const avg = hasVehicle ? (o.car_avg_seconds ?? null) : o.avg_seconds
                const n = hasVehicle ? (o.car_samples_count ?? 0) : o.samples_count
                const diff = avg !== null ? normMin * 60 - avg : null
                const source = o.car_norm_source ?? 'default'
                const ownNorm = hasVehicle && source === level && o.car_norm_id
                return (
                  <tr key={o.id} style={{ opacity: o.is_active ? 1 : 0.55 }}>
                    <td>{o.name}{!o.is_active && <span className="tag tag-outline" style={{ marginLeft: 8 }}>neaktívny</span>}</td>
                    <td className="nowrap">{categoryLabel(o.category)}</td>
                    {hasVehicle ? (
                      <td className="nowrap">
                        {editingNorm?.id === o.id ? (
                          <form className="norm-cell" onSubmit={e => { e.preventDefault(); void saveNorm(o) }}>
                            <input className="input" inputMode="numeric" value={editingNorm.minutes} onChange={e => setEditingNorm({ id: o.id, minutes: e.target.value })} autoFocus aria-label="Norma v minútach" />
                            <span className="muted" style={{ fontSize: 11 }}>min</span>
                            <button type="submit" className="btn btn-primary" style={{ minHeight: 28, fontSize: 12 }} disabled={busy}>Uložiť</button>
                            <button type="button" className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }} aria-label="Zrušiť" onClick={() => setEditingNorm(null)}><X size={14} strokeWidth={1.5} /></button>
                          </form>
                        ) : (
                          <span className="norm-cell">
                            <span className={`hd num ${source !== 'default' ? 'norm-ok' : ''}`} style={source === 'default' ? { color: 'inherit' } : undefined}>{hm(normMin * 60)}</span>
                            <span className={source === 'default' ? 'tag tag-neutral' : 'tag tag-accent'} style={{ fontSize: 10 }}>{SOURCE_LABEL[source]}</span>
                            <button type="button" className="btn btn-ghost btn-icon" style={{ width: 26, height: 26 }} aria-label={`Nastaviť normu pre ${vehicleLabel}`} title={`Nastaviť normu pre ${vehicleLabel}`} onClick={() => setEditingNorm({ id: o.id, minutes: String(normMin) })}><Pencil size={12} strokeWidth={1.5} /></button>
                            {ownNorm && <button type="button" className="btn btn-ghost btn-icon" style={{ width: 26, height: 26 }} aria-label="Odstrániť normu pre toto vozidlo" title="Odstrániť normu pre toto vozidlo (vráti sa na vyššiu úroveň)" disabled={busy} onClick={() => void dropNorm(o.car_norm_id as number)}><X size={12} strokeWidth={1.5} /></button>}
                          </span>
                        )}
                      </td>
                    ) : (
                      <td className="num nowrap">{hm(o.norm_minutes * 60)}</td>
                    )}
                    {hasVehicle
                      ? <td className="num nowrap muted">{hm(o.norm_minutes * 60)}</td>
                      : <td className="nowrap muted" style={{ fontSize: 12 }}>{o.norms.length ? `${o.norms.length}× (${o.norms.slice(0, 2).map(x => [x.car_make, x.car_model, x.car_engine].filter(Boolean).join(' ')).join(', ')}${o.norms.length > 2 ? '…' : ''})` : '—'}</td>}
                    <td className="num nowrap">{avg !== null ? `${hm(avg)} (${n}×)` : '—'}</td>
                    <td className={`num nowrap ${diff === null ? '' : diff >= 0 ? 'norm-ok' : 'norm-bad'}`}>{diff === null ? '—' : `${diff >= 0 ? '+' : '−'}${hm(Math.abs(diff))}`}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-icon" style={{ width: 32, height: 32 }} aria-label="Upraviť úkon" title="Upraviť úkon (názov, kategória, všeobecná norma)" onClick={() => setEditing(o)}><Pencil size={14} strokeWidth={1.5} /></button></td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan={7} className="muted">{catalog.isPending ? 'Načítavam…' : 'Žiadne úkony.'}</td></tr>}
              {rows.length > 0 && <tr><td colSpan={7} className="muted" style={{ fontSize: 12 }}>{rows.length} {rows.length === 1 ? 'úkon' : rows.length < 5 ? 'úkony' : 'úkonov'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Blueprint>

      <OperationDialog open={creating} onClose={() => setCreating(false)} />
      <OperationDialog open={!!editing} onClose={() => setEditing(null)} operation={editing ? (catalog.data?.find(o => o.id === editing.id) ?? editing) : undefined} />
    </div>
  )
}

function OperationDialog({ open, onClose, operation }: { open: boolean; onClose: () => void; operation?: Operation }) {
  const { createOperation, updateOperation, removeOperation, removeNorm } = useOperationActions()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('servis')
  const [minutes, setMinutes] = useState('')
  const [active, setActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seeded, setSeeded] = useState<number | 'new' | null>(null)

  const key = operation?.id ?? 'new'
  if (open && seeded !== key) {
    setSeeded(key); setName(operation?.name ?? ''); setCategory(operation?.category ?? 'servis'); setMinutes(operation ? String(operation.norm_minutes) : ''); setActive(operation?.is_active ?? true); setError(null)
  }
  if (!open && seeded !== null) setSeeded(null)

  const wrap = async (fn: () => Promise<unknown>, close = true) => {
    setBusy(true); setError(null)
    try { await fn(); if (close) onClose() } catch (e) { setError(e instanceof ApiError ? e.message : 'Nepodarilo sa uložiť.') } finally { setBusy(false) }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const m = parseInt(minutes, 10)
    if (!name.trim() || !m || m <= 0) return
    const body: OperationPayload = { name: name.trim(), category, norm_minutes: m, is_active: active }
    void wrap(() => (operation ? updateOperation(operation.id, body) : createOperation(body)))
  }
  const formId = operation ? `op-${operation.id}` : 'op-new'

  return (
    <Dialog open={open} title={operation ? 'Upraviť úkon' : 'Nový úkon'} onClose={onClose}
      actions={<>
        {operation && <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} disabled={busy} onClick={() => void wrap(() => removeOperation(operation.id))}>{operation.samples_count ? 'Deaktivovať' : 'Zmazať'}</button>}
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Zrušiť</button>
        <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>{busy ? 'Ukladám…' : 'Uložiť'}</button>
      </>}>
      <form id={formId} onSubmit={submit}>
        <div className="field"><label htmlFor={`${formId}-name`}>Názov</label><input id={`${formId}-name`} className="input" value={name} onChange={e => setName(e.target.value)} required autoFocus /></div>
        <div className="row">
          <div className="field"><label htmlFor={`${formId}-cat`}>Kategória</label>
            <select id={`${formId}-cat`} className="input" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select>
          </div>
          <div className="field"><label htmlFor={`${formId}-min`}>Všeobecná norma (minúty)</label><input id={`${formId}-min`} className="input" inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} required /></div>
        </div>
        {operation && (
          <label className="radio" style={{ gap: 10 }}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ position: 'static', opacity: 1, width: 16, height: 16, pointerEvents: 'auto' }} />
            Aktívny (ponúka sa pri pridávaní na zákazku)
          </label>
        )}
        {operation?.avg_seconds != null && <div className="muted" style={{ fontSize: 12 }}>Tvoj priemer {hm(operation.avg_seconds)} z {operation.samples_count} zákaziek (všetky vozidlá).</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
      {operation && operation.norms.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-divider)' }}>
          <div className="card-kicker">Normy podľa vozidla</div>
          {operation.norms.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{[n.car_make, n.car_model, n.car_engine].filter(Boolean).join(' ')}{!n.car_model ? <span className="muted"> · celá značka</span> : !n.car_engine ? <span className="muted"> · všetky motorizácie</span> : null}</span>
              <span className="hd num">{hm(n.norm_minutes * 60)}</span>
              <button type="button" className="btn btn-ghost" style={{ minHeight: 28, fontSize: 12 }} disabled={busy} onClick={() => void wrap(() => removeNorm(n.id), false)}>odstrániť</button>
            </div>
          ))}
          <div className="muted" style={{ fontSize: 11 }}>Nové normy podľa vozidla nastavíš v tabuľke po výbere vozidla.</div>
        </div>
      )}
    </Dialog>
  )
}
