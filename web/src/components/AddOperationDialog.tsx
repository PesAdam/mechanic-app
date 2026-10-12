import { useState, type FormEvent } from 'react'
import Dialog from './Dialog'
import { useOperations, useOrderActions } from '../data/queries'
import { ApiError } from '../lib/api'
import { hm } from '../lib/format'

const CATEGORY_LABEL: Record<string, string> = {
  servis: 'Servis', brzdy: 'Brzdy', motor: 'Motor', podvozok: 'Podvozok', prevodovka: 'Prevodovka',
  elektro: 'Elektro', klima: 'Klimatizácia', diagnostika: 'Diagnostika', karoseria: 'Karoséria', ine: 'Iné',
}
export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? c

interface Props { open: boolean; onClose: () => void; orderId: number; carModelId?: number | null; carEngineId?: number | null; carLabel?: string }

/** Pick a job from the catalogue (search) or type a one-off job with its own norm. */
export default function AddOperationDialog({ open, onClose, orderId, carModelId, carEngineId, carLabel }: Props) {
  const catalog = useOperations(carModelId, carEngineId)
  const { addOperation } = useOrderActions()
  const [query, setQuery] = useState('')
  const [customName, setCustomName] = useState('')
  const [customMinutes, setCustomMinutes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const matches = (catalog.data ?? []).filter(o => o.is_active && (!q || o.name.toLowerCase().includes(q) || categoryLabel(o.category).toLowerCase().includes(q))).slice(0, 40)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try { await fn(); setQuery(''); setCustomName(''); setCustomMinutes(''); onClose() } catch (e) { setError(e instanceof ApiError ? e.message : 'Nepodarilo sa pridať úkon.') } finally { setBusy(false) }
  }
  const submitCustom = (e: FormEvent) => {
    e.preventDefault()
    const m = parseInt(customMinutes, 10)
    if (!customName.trim() || !m || m <= 0) return
    void run(() => addOperation(orderId, { name: customName.trim(), norm_minutes: m }))
  }

  return (
    <Dialog open={open} title="Pridať úkon" onClose={onClose}
      actions={<button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Zavrieť</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {carLabel && <div className="muted" style={{ fontSize: 12 }}>Normy pre {carLabel}: motorizácia → model → značka → všeobecná.</div>}
        <div className="field"><label htmlFor="op-q">Z katalógu</label><input id="op-q" className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Hľadať: brzdy, olej, spojka…" autoFocus /></div>
        <div className="op-list">
          {matches.map(o => (
            <button key={o.id} type="button" className="op-pick" disabled={busy} onClick={() => void run(() => addOperation(orderId, { operation_id: o.id }))}>
              <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 14 }}>{o.name}</span><span className="muted" style={{ fontSize: 11 }}>
                {categoryLabel(o.category)}
                {o.car_norm_source === 'engine' ? ' · norma pre túto motorizáciu' : o.car_norm_source === 'model' ? ' · norma pre tento model' : o.car_norm_source === 'make' ? ' · norma pre značku' : ''}
                {o.car_avg_seconds ? ` · priemer na tomto modeli ${hm(o.car_avg_seconds)} (${o.car_samples_count}×)` : o.avg_seconds ? ` · tvoj priemer ${hm(o.avg_seconds)} (${o.samples_count}×)` : ''}
              </span></span>
              <span className="hd num" style={{ whiteSpace: 'nowrap' }}>{hm((o.car_norm_minutes ?? o.norm_minutes) * 60)}</span>
            </button>
          ))}
          {!matches.length && <div className="muted" style={{ fontSize: 13, padding: 10 }}>{catalog.isPending ? 'Načítavam katalóg…' : 'Nič sa nenašlo. Pridajte vlastný úkon nižšie.'}</div>}
        </div>
        <form onSubmit={submitCustom} style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 8, alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}><label htmlFor="op-name">Vlastný úkon</label><input id="op-name" className="input" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Názov" /></div>
          <div className="field" style={{ margin: 0 }}><label htmlFor="op-min">Norma (min)</label><input id="op-min" className="input" inputMode="numeric" value={customMinutes} onChange={e => setCustomMinutes(e.target.value)} placeholder="60" /></div>
          <button type="submit" className="btn btn-secondary" style={{ minHeight: 36 }} disabled={busy}>Pridať</button>
        </form>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Dialog>
  )
}
