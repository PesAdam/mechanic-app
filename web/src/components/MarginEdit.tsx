import { useState } from 'react'
import { Check, Pencil, RotateCcw, X } from 'lucide-react'
import { eur } from '../lib/format'

const round2 = (n: number): number => Math.round(n * 100) / 100

interface Props {
  /** Billed − NC, before the úprava. */
  computed: number
  adjustment: number | null
  busy: boolean
  locked?: boolean
  onSave: (adjustment: number | null) => Promise<unknown>
}

/**
 * "Marža na dieloch" the owner can correct when part of it goes to someone else: he types the margin he keeps,
 * the difference is stored (−50 €), so parts added later still count. Only zárobok moves, the customer pays the same.
 */
export default function MarginEdit({ computed, adjustment, busy, locked, onSave }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const adj = adjustment ?? 0
  const margin = round2(computed + adj)
  const iconBtn = { minHeight: 0, padding: 2 }

  const save = async () => {
    if (draft === null) return
    const v = round2(Number(draft.replace(',', '.').replace(/\s|€/g, '')))
    if (!draft.trim() || !Number.isFinite(v)) return
    const next = round2(v - computed)
    await onSave(next === 0 ? null : next)
    setDraft(null)
  }

  if (draft !== null) {
    return (
      <form className="r-line muted" style={{ fontSize: 12, alignItems: 'center' }} onSubmit={e => { e.preventDefault(); void save() }}>
        <span>Marža na dieloch</span>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input className="input" autoFocus inputMode="decimal" aria-label="Nová marža" value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setDraft(null) }} style={{ width: 90, minHeight: 28, padding: '2px 6px', textAlign: 'right' }} />
          <button type="submit" className="btn btn-ghost" style={{ minHeight: 28, padding: '0 6px' }} disabled={busy} aria-label="Uložiť maržu"><Check size={12} strokeWidth={1.5} /></button>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 28, padding: '0 6px' }} onClick={() => setDraft(null)} aria-label="Zrušiť"><X size={12} strokeWidth={1.5} /></button>
        </span>
      </form>
    )
  }

  return (
    <>
      <div className="r-line muted" style={{ fontSize: 12, alignItems: 'center' }}>
        <span>Marža na dieloch</span>
        <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
          {!locked && <>
            <button className="btn btn-ghost" style={iconBtn} disabled={busy} title="Upraviť maržu – napr. keď časť z nej dáš niekomu; zákazník platí to isté" aria-label="Upraviť maržu"
              onClick={() => setDraft(margin.toFixed(2).replace('.', ','))}><Pencil size={12} strokeWidth={1.5} /></button>
            {adj !== 0 && <button className="btn btn-ghost" style={iconBtn} disabled={busy} title="Vrátiť vypočítanú maržu" aria-label="Vrátiť vypočítanú maržu"
              onClick={() => void onSave(null)}><RotateCcw size={12} strokeWidth={1.5} /></button>}
          </>}
          <span style={adj ? { color: 'var(--color-bad)', fontWeight: 600 } : undefined}>{eur(margin)}</span>
        </span>
      </div>
      {adj !== 0 && (
        <div className="muted" style={{ fontSize: 11, textAlign: 'right' }}>
          vypočítaná <s>{eur(computed)}</s> · <span style={{ color: 'var(--color-bad)', fontWeight: 600 }}>{adj < 0 ? `odvod −${eur(-adj)}` : `navýšenie +${eur(adj)}`}</span>
        </div>
      )}
    </>
  )
}
