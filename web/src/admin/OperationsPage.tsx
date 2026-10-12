import { useState, type FormEvent } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useOperationActions, useOperations, type OperationPayload } from '../data/queries'
import { ApiError } from '../lib/api'
import { hm } from '../lib/format'
import type { Operation } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'
import Dialog from '../components/Dialog'
import { categoryLabel } from '../components/AddOperationDialog'

const CATEGORIES = ['servis', 'brzdy', 'motor', 'podvozok', 'prevodovka', 'elektro', 'klima', 'diagnostika', 'karoseria', 'ine']

/** Katalóg úkonov: norms you bill against and the averages the shop actually achieves. */
export default function OperationsPage() {
  const catalog = useOperations()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Operation | null>(null)
  const [creating, setCreating] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const q = query.trim().toLowerCase()
  const rows = (catalog.data ?? []).filter(o => (showInactive || o.is_active) && (!q || o.name.toLowerCase().includes(q) || categoryLabel(o.category).toLowerCase().includes(q)))

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><div className="kicker">Normohodiny</div><h1>Úkony</h1></div>
        <div className="admin-actions">
          <input className="input" style={{ width: 240, minHeight: 36 }} placeholder="Hľadať úkon…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Hľadať" />
          <label className="radio" style={{ gap: 8, fontSize: 13 }}><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ position: 'static', opacity: 1, width: 14, height: 14, pointerEvents: 'auto' }} />aj neaktívne</label>
          <button className="btn btn-primary blueprint" style={{ minHeight: 36 }} onClick={() => setCreating(true)}><Corners /><Plus size={16} strokeWidth={1.5} />Pridať úkon</button>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 13, maxWidth: 760 }}>
        Norma je čas, ktorý má úkon trvať. Východiskové hodnoty sú orientačné, prepíš ich normami od svojho dodávateľa dielov alebo z Autodata / TecRMI. „Tvoj priemer“ vzniká z uzavretých zákaziek: skutočný čas sa rozdelí medzi úkony pomerne podľa noriem.
      </div>
      <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Úkon</th><th>Kategória</th><th>Norma</th><th>Tvoj priemer</th><th>Rozdiel</th><th></th></tr></thead>
            <tbody>
              {rows.map(o => {
                const diff = o.avg_seconds !== null ? o.norm_minutes * 60 - o.avg_seconds : null
                return (
                  <tr key={o.id} style={{ opacity: o.is_active ? 1 : 0.55 }}>
                    <td>{o.name}{!o.is_active && <span className="tag tag-outline" style={{ marginLeft: 8 }}>neaktívny</span>}</td>
                    <td className="nowrap">{categoryLabel(o.category)}</td>
                    <td className="num nowrap">{hm(o.norm_minutes * 60)}</td>
                    <td className="num nowrap">{o.avg_seconds !== null ? `${hm(o.avg_seconds)} (${o.samples_count}×)` : '—'}</td>
                    <td className={`num nowrap ${diff === null ? '' : diff >= 0 ? 'norm-ok' : 'norm-bad'}`}>{diff === null ? '—' : `${diff >= 0 ? '+' : '−'}${hm(Math.abs(diff))}`}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-icon" style={{ width: 32, height: 32 }} aria-label="Upraviť" onClick={() => setEditing(o)}><Pencil size={14} strokeWidth={1.5} /></button></td>
                  </tr>
                )
              })}
              {!rows.length && <tr><td colSpan={6} className="muted">{catalog.isPending ? 'Načítavam…' : 'Žiadne úkony.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Blueprint>
      <OperationDialog open={creating} onClose={() => setCreating(false)} />
      <OperationDialog open={!!editing} onClose={() => setEditing(null)} operation={editing ?? undefined} />
    </div>
  )
}

function OperationDialog({ open, onClose, operation }: { open: boolean; onClose: () => void; operation?: Operation }) {
  const { createOperation, updateOperation, removeOperation } = useOperationActions()
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

  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await fn(); onClose() } catch (e) { setError(e instanceof ApiError ? e.message : 'Nepodarilo sa uložiť.') } finally { setBusy(false) }
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
          <div className="field"><label htmlFor={`${formId}-min`}>Norma (minúty)</label><input id={`${formId}-min`} className="input" inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} required /></div>
        </div>
        {operation && (
          <label className="radio" style={{ gap: 10 }}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ position: 'static', opacity: 1, width: 16, height: 16, pointerEvents: 'auto' }} />
            Aktívny (ponúka sa pri pridávaní na zákazku)
          </label>
        )}
        {operation?.avg_seconds != null && <div className="muted" style={{ fontSize: 12 }}>Tvoj priemer {hm(operation.avg_seconds)} z {operation.samples_count} zákaziek.</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  )
}
