import { useMemo } from 'react'
import { create } from 'qrcode'
import { CurrencyCode, PaymentOptions, encode } from 'bysquare/pay'
import { Corners } from './Blueprint'

interface Props {
  iban: string
  amount: number
  /** Variabilný symbol, digits only. */
  vs: string
  /** Who receives the money – the business name. */
  beneficiary: string
  /** YYYY-MM-DD */
  due?: string
  note?: string
}

/** PAY by square QR code: banking apps prefill IBAN, amount and VS from it. */
export default function PayBySquare({ iban, amount, vs, beneficiary, due, note }: Props) {
  const qr = useMemo(() => {
    const account = iban.replace(/\s+/g, '').toUpperCase()
    if (!account) return { error: 'Doplňte IBAN v Nastaveniach, aby sa tu zobrazil QR kód na platbu.' }
    if (!(amount > 0)) return { error: 'Nie je čo uhradiť.' }
    try {
      const text = encode({
        payments: [{
          type: PaymentOptions.PaymentOrder,
          amount: Math.round(amount * 100) / 100,
          currencyCode: CurrencyCode.EUR,
          variableSymbol: vs,
          paymentDueDate: due?.replace(/-/g, ''),
          paymentNote: note,
          beneficiary: { name: beneficiary || 'Dielňa' },
          bankAccounts: [{ iban: account }],
        }],
      })
      return { modules: create(text, { errorCorrectionLevel: 'M' }).modules }
    } catch {
      return { error: 'IBAN v Nastaveniach nie je platný, QR kód sa nedá vytvoriť.' }
    }
  }, [iban, amount, vs, beneficiary, due, note])

  if (!qr.modules) return <div className="muted" style={{ fontSize: 12, maxWidth: 180, textAlign: 'center', alignSelf: 'center' }}>{qr.error}</div>

  const size = qr.modules.size
  let path = ''
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (qr.modules.get(y, x)) path += `M${x} ${y}h1v1h-1z`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div className="blueprint r-qr">
        <Corners />
        <svg viewBox={`0 0 ${size} ${size}`} width="148" height="148" shapeRendering="crispEdges" role="img" aria-label="PAY by square QR kód na platbu">
          <path d={path} fill="#000" />
        </svg>
      </div>
      <div className="kicker">PAY by square</div>
      <div className="muted" style={{ fontSize: 11, textAlign: 'center' }}>Naskenujte v bankovej appke · suma a VS sú predvyplnené</div>
    </div>
  )
}
