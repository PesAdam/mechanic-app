import { useState } from 'react'
import Dialog from './Dialog'
import { useOrderActions } from '../data/queries'
import { ApiError } from '../lib/api'
import { eur, hm } from '../lib/format'
import { PRICING_LABEL, partsAt, totalsOf } from '../lib/calc'
import type { LaborBilling, Order, PartsPricing } from '../lib/types'

interface Props { order: Order; rate: number; now: number; billing?: LaborBilling; open: boolean; onClose: () => void; onClosed?: (order: Order) => void }

/** "Uzavrieť": the last chance to pick MOC, stred or NC for the customer's report, with the total in view. */
export default function CloseOrderDialog({ order, rate, now, billing, open, onClose, onClosed }: Props) {
  const { closeOrder } = useOrderActions()
  const [pricing, setPricing] = useState<PartsPricing>(order.parts_pricing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = totalsOf(order, rate, now, billing)
  const parts = partsAt(order, pricing)
  const missingNc = pricing !== 'moc' ? order.parts.filter(p => p.used && p.purchase_price === null).length : 0

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const closed = await closeOrder(order.id, pricing)
      onClose()
      onClosed?.(closed)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Nepodarilo sa uzavrieť zákazku.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title={`Uzavrieť zákazku #${order.number}`} onClose={onClose}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Späť</button><button type="button" className="btn btn-primary" onClick={() => void confirm()} disabled={busy}>{busy ? 'Uzatváram…' : 'Uzavrieť a vytvoriť report'}</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div className="card-kicker" style={{ marginBottom: 6 }}>Ceny dielov na reporte</div>
          <div className="seg">
            <label className="seg-opt"><input type="radio" name="close-pricing" checked={pricing === 'moc'} onChange={() => setPricing('moc')} />MOC · predajné</label>
            <label className="seg-opt"><input type="radio" name="close-pricing" checked={pricing === 'mid'} onChange={() => setPricing('mid')} />Stred</label>
            <label className="seg-opt"><input type="radio" name="close-pricing" checked={pricing === 'nc'} onChange={() => setPricing('nc')} />NC · nákupné</label>
            <label className="seg-opt"><input type="radio" name="close-pricing" checked={pricing === 'n10'} onChange={() => setPricing('n10')} />NC+10%</label>
          </div>
          {missingNc > 0 && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{missingNc} {missingNc === 1 ? 'diel nemá' : missingNc <= 4 ? 'diely nemajú' : 'dielov nemá'} zadanú NC, započíta sa ich MOC.</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
          <div className="r-line"><span>Práca · {t.labor_billing === 'norm' ? `norma ${hm(t.norm_seconds)}` : hm(t.seconds)} × {t.rate} €/h</span><span>{eur(t.labor)}</span></div>
          <div className="r-line"><span>Diely · {PRICING_LABEL[pricing]}</span><span>{eur(parts)}</span></div>
          {order.total_override !== null
            ? <>
              <div className="r-line" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 6 }}><span className="hd">K úhrade · upravená suma</span><span className="hd" style={{ fontSize: 20, color: 'var(--color-bad)' }}>{eur(order.total_override)}</span></div>
              <div className="r-line muted" style={{ fontSize: 12 }}><span>vypočítané</span><s>{eur(t.labor + parts)}</s></div>
            </>
            : <div className="r-line" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 6 }}><span className="hd">K úhrade</span><span className="hd" style={{ fontSize: 20 }}>{eur(t.labor + parts)}</span></div>}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>Stopky sa zastavia a zákazka prejde do stavu „čaká na platbu“. Ceny dielov sa dajú neskôr zmeniť v desktopovom detaile.</div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Dialog>
  )
}
