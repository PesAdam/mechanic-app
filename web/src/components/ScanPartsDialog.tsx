import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Check, ImageUp } from 'lucide-react'
import Dialog from './Dialog'
import { useOrderActions } from '../data/queries'
import { ApiError } from '../lib/api'
import { eur } from '../lib/format'
import { readWords } from '../lib/ocr'
import { partMeta, partsFromWords, type ScannedPart } from '../lib/partsScan'
import { plural } from '../lib/text'

interface Props { open: boolean; onClose: () => void; orderId: number }
interface Row { on: boolean; name: string; meta: string; price: string; scan: ScannedPart }
type Vat = 'gross' | 'net'

const priceText = (p: ScannedPart, vat: Vat): string => {
  const v = vat === 'net' ? p.net ?? p.gross : p.gross ?? p.net
  return v === null ? '' : v.toFixed(2).replace('.', ',')
}
const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isNaN(n) ? null : n }

/**
 * "Zo screenshotu": a supplier's cart or order (Autosave, AutodielyPRO, …) is read on the device, the rows are
 * checked and corrected here, then added as parts with the shown price as MOC.
 */
export default function ScanPartsDialog({ open, onClose, orderId }: Props) {
  const { addParts } = useOrderActions()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [vat, setVat] = useState<Vat>('gross')
  const [reading, setReading] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // A scan still running when the dialog is closed must not fill it the next time it opens.
  const run = useRef(0)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const close = () => {
    run.current++
    setRows(null); setReading(null); setError(null); setPreview(null); setVat('gross')
    onClose()
  }

  const read = async (image: Blob) => {
    const id = ++run.current
    setRows(null); setError(null); setReading(0); setVat('gross')
    setPreview(URL.createObjectURL(image))
    try {
      const found = partsFromWords(await readWords(image, share => { if (run.current === id) setReading(share) }))
      if (run.current !== id) return
      if (!found.length) setError('Na obrázku som nenašiel diely s cenou. Skús výrez len s riadkami dielov alebo pridaj diel ručne.')
      else setRows(found.map(p => ({ on: p.suggested, name: p.name, meta: partMeta(p), price: priceText(p, 'gross'), scan: p })))
    } catch {
      if (run.current === id) setError('Obrázok sa nepodarilo prečítať.')
    } finally {
      if (run.current === id) setReading(null)
    }
  }

  // Ctrl+V / ⌘V of a screenshot straight from the clipboard.
  useEffect(() => {
    if (!open || rows || reading !== null) return
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'))
      if (file) { e.preventDefault(); void read(file) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  const drop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'))
    if (file) void read(file)
  }

  const edit = (i: number, patch: Partial<Row>) => setRows(rs => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const switchVat = (v: Vat) => { setVat(v); setRows(rs => rs && rs.map(r => ({ ...r, price: priceText(r.scan, v) }))) }

  const chosen = (rows ?? []).filter(r => r.on)
  const valid = chosen.every(r => r.name.trim() && (num(r.price) ?? -1) >= 0)
  const sum = chosen.reduce((a, r) => a + (num(r.price) ?? 0), 0)
  const bothVat = (rows ?? []).some(r => r.scan.gross !== null && r.scan.net !== null)

  const submit = async () => {
    if (!chosen.length || !valid) return
    setBusy(true)
    setError(null)
    try {
      await addParts(orderId, chosen.map(r => ({ name: r.name.trim(), meta: r.meta.trim(), price: num(r.price) ?? 0, purchase_price: null })))
      close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nepodarilo sa uložiť.')
    } finally {
      setBusy(false)
    }
  }

  const pick = (
    <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={reading !== null || busy}>
      <ImageUp size={16} strokeWidth={1.5} /> {rows ? 'Iný obrázok' : 'Vybrať obrázok'}
    </button>
  )

  return (
    <Dialog open={open} title="Diely zo screenshotu" onClose={close}
      actions={<>
        <button type="button" className="btn btn-secondary" onClick={close} disabled={busy}>Zrušiť</button>
        {rows && <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy || !chosen.length || !valid}>
          Pridať {chosen.length} {plural(chosen.length, 'diel', 'diely', 'dielov')}
        </button>}
      </>}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f) }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!rows && reading === null && (
          <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={drop}
            style={{ border: `1.5px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-divider)'}`, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 13 }}>Screenshot košíka alebo objednávky od dodávateľa (Autosave, AutodielyPRO…). Vlož ho cez Ctrl+V, pretiahni sem alebo vyber súbor.</div>
            {pick}
          </div>
        )}

        {reading !== null && (
          <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13 }}>{reading > 0 ? `Čítam text… ${Math.round(reading * 100)} %` : 'Pripravujem čítanie textu… (prvýkrát to chvíľu trvá)'}</div>
            <div style={{ height: 4, background: 'var(--color-divider)' }}><div style={{ height: 4, width: `${Math.round(reading * 100)}%`, background: 'var(--color-accent)', transition: 'width 0.2s' }} /></div>
          </div>
        )}

        {preview && <img src={preview} alt="Načítaný screenshot" style={{ maxHeight: 110, objectFit: 'contain', objectPosition: 'left', border: '1px solid var(--color-divider)' }} />}

        {rows && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 12 }}>Skontroluj a oprav riadky. Ceny sa uložia ako MOC.</span>
              {bothVat && (
                <div className="seg" aria-label="Cena">
                  <label className="seg-opt" style={{ minHeight: 30, fontSize: 12 }}><input type="radio" name="scan-vat" checked={vat === 'gross'} onChange={() => switchVat('gross')} />s DPH</label>
                  <label className="seg-opt" style={{ minHeight: 30, fontSize: 12 }}><input type="radio" name="scan-vat" checked={vat === 'net'} onChange={() => switchVat('net')} />bez DPH</label>
                </div>
              )}
            </div>
            <div>
              {rows.map((r, i) => (
                <div key={i} className="part-row" style={{ cursor: 'default', alignItems: 'flex-start', opacity: r.on ? 1 : 0.55 }}>
                  <button type="button" className="part-box" style={{ marginTop: 13, background: r.on ? 'var(--color-accent)' : 'transparent', cursor: 'pointer' }}
                    onClick={() => edit(i, { on: !r.on })} aria-pressed={r.on} aria-label={`Pridať: ${r.name}`}>
                    {r.on && <Check size={12} strokeWidth={2.5} color="#fff" />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
                    <input className="input" value={r.name} onChange={e => edit(i, { name: e.target.value })} aria-label="Názov" disabled={!r.on} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px', gap: 6 }}>
                      <input className="input" value={r.meta} onChange={e => edit(i, { meta: e.target.value })} placeholder="2 ks · kód" aria-label="Množstvo · kód" disabled={!r.on} />
                      <input className="input num" inputMode="decimal" value={r.price} onChange={e => edit(i, { price: e.target.value })} aria-label="MOC (€)" disabled={!r.on} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              {pick}
              <span className="hd num">{eur(sum)}</span>
            </div>
          </>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Dialog>
  )
}
