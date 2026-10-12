import { Corners } from './Blueprint'

/** Placeholder PAY by square code from the design. A real one needs the
 *  bysquare encoding of IBAN, amount and VS — see README "Ďalšie kroky". */
export default function PayBySquare() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div className="blueprint r-qr" aria-label="PAY by square QR kód (ukážka)">
        <Corners />
        <svg viewBox="0 0 21 21" width="148" height="148" shapeRendering="crispEdges" fill="var(--color-text)" role="img" aria-hidden="true">
          <path d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2zM14 0h7v7h-7zM15 1v5h5V1zM16 2h3v3h-3zM0 14h7v7H0zM1 15v5h5v-5zM2 16h3v3H2z" fillRule="evenodd" />
          <path d="M8 0h1v1H8zM10 0h1v2h-1zM12 1h1v1h-1zM8 2h2v1H8zM11 3h1v1h-1zM8 4h1v2H8zM10 5h2v1h-2zM12 6h1v1h-1zM0 8h1v1H0zM2 8h2v1H2zM5 8h1v1H5zM7 8h1v2H7zM9 8h2v1H9zM12 8h1v1h-1zM14 8h2v1h-2zM17 8h1v1h-1zM19 8h2v1h-2zM1 10h1v1H1zM3 10h1v1H3zM6 10h1v1H6zM9 10h1v2H9zM11 10h2v1h-2zM15 10h1v1h-1zM17 10h2v1h-2zM20 10h1v1h-1zM0 12h2v1H0zM4 12h2v1H4zM7 12h1v1H7zM10 12h3v1h-3zM14 12h1v2h-1zM16 12h1v1h-1zM18 12h3v1h-3zM8 14h2v1H8zM11 14h1v1h-1zM13 14h1v1h-1zM16 14h2v1h-2zM19 14h1v1h-1zM8 16h1v1H8zM10 16h2v1h-2zM13 16h2v1h-2zM17 16h1v2h-1zM20 16h1v1h-1zM9 18h1v1H9zM11 18h1v1h-1zM14 18h2v1h-2zM19 18h2v1h-2zM8 20h2v1H8zM12 20h1v1h-1zM15 20h1v1h-1zM18 20h1v1h-1z" />
        </svg>
      </div>
      <div className="kicker">PAY by square</div>
      <div className="muted" style={{ fontSize: 11, textAlign: 'center' }}>Naskenujte v bankovej appke · suma a VS sú predvyplnené</div>
    </div>
  )
}
