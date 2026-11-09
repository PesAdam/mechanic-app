import { useOrderActions } from '../data/queries'
import { PRICING_LABEL, PRICING_MODES } from '../lib/calc'
import type { Order, PartsPricing } from '../lib/types'

interface Props { order: Order; disabled?: boolean; onError?: (message: string) => void; compact?: boolean }

/** Which part prices go on this order's report: MOC (retail), STRED (halfway), NC (purchase) or NC+10%. Saved on the order. */
export default function PricingSwitch({ order, disabled, onError, compact }: Props) {
  const { updateOrder } = useOrderActions()
  const choose = (mode: PartsPricing) => {
    if (mode === order.parts_pricing) return
    updateOrder(order.id, { parts_pricing: mode }).catch(e => onError?.(e instanceof Error ? e.message : 'Nepodarilo sa uložiť.'))
  }
  const style = compact ? { padding: '3px 8px', fontSize: 11 } : undefined
  return (
    <div className="seg" role="radiogroup" aria-label="Ceny dielov na reporte" title="MOC = predajná cena · STRED = v polovici medzi MOC a NC · NC = nákupná cena · NC+10% = nákupná cena + 10 %. Platí pre doklad a report tejto zákazky.">
      {PRICING_MODES.map(mode => (
        <label key={mode} className="seg-opt" style={style}><input type="radio" name={`pricing-${order.id}`} checked={order.parts_pricing === mode} onChange={() => choose(mode)} disabled={disabled} />{PRICING_LABEL[mode]}</label>
      ))}
    </div>
  )
}
