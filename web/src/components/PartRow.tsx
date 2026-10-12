import { Check, Pencil } from 'lucide-react'
import { eur } from '../lib/format'
import { partPrice } from '../lib/calc'
import type { Part, PartsPricing } from '../lib/types'

interface Props {
  part: Part
  mode: PartsPricing
  disabled: boolean
  onToggle: () => void
  onEdit?: () => void
}

/** One part: tick = charged to the customer, price in the chosen mode, optional edit. */
export default function PartRow({ part, mode, disabled, onToggle, onEdit }: Props) {
  const noNc = mode === 'nc' && part.purchase_price === null
  return (
    <div className="part-row" style={{ cursor: 'default' }}>
      <button type="button" className="part-box" style={{ background: part.used ? 'var(--color-accent)' : 'transparent', cursor: disabled ? 'default' : 'pointer' }}
        onClick={onToggle} disabled={disabled} aria-pressed={part.used} aria-label={part.used ? 'Účtovať: áno' : 'Účtovať: nie'}>
        {part.used && <Check size={12} strokeWidth={2.5} color="#fff" />}
      </button>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{part.name}</span>
        {part.meta && <span className="muted" style={{ display: 'block', fontSize: 11 }}>{part.meta}</span>}
      </span>
      <span style={{ textAlign: 'right' }}>
        <span className="hd num" style={{ display: 'block', fontSize: 16, opacity: part.used ? 1 : 0.5 }}>{eur(partPrice(part, mode))}</span>
        {noNc && <span className="muted" style={{ display: 'block', fontSize: 10 }}>NC nezadaná</span>}
      </span>
      {onEdit && !disabled && (
        <button type="button" className="btn btn-ghost btn-icon" style={{ width: 32, height: 32 }} onClick={onEdit} aria-label="Upraviť diel">
          <Pencil size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}
