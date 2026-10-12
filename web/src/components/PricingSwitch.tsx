import { useOrderActions } from '../data/queries'
import type { Order, PartsPricing } from '../lib/types'

interface Props { order: Order; disabled?: boolean; onError?: (message: string) => void; compact?: boolean }

/** Which part prices go on this order's report: MOC (retail) or NC (purchase). Saved on the order. */
export default function PricingSwitch({ order, disabled, onError, compact }: Props) {
  const { updateOrder } = useOrderActions()
  const choose = (mode: PartsPricing) => {
    if (mode === order.parts_pricing) return
    updateOrder(order.id, { parts_pricing: mode }).catch(e => onError?.(e instanceof Error ? e.message : 'Nepodarilo sa uložiť.'))
  }
  const style = compact ? { padding: '3px 8px', fontSize: 11 } : undefined
  return (
    <div className="seg" role="radiogroup" aria-label="Ceny dielov na reporte" title="MOC = predajná cena · NC = nákupná cena. Platí pre doklad a report tejto zákazky.">
      <label className="seg-opt" style={style}><input type="radio" name={`pricing-${order.id}`} checked={order.parts_pricing === 'moc'} onChange={() => choose('moc')} disabled={disabled} />MOC</label>
      <label className="seg-opt" style={style}><input type="radio" name={`pricing-${order.id}`} checked={order.parts_pricing === 'nc'} onChange={() => choose('nc')} disabled={disabled} />NC</label>
    </div>
  )
}
