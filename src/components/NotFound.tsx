import { Link } from 'react-router'
import Blueprint from './Blueprint'

export default function NotFound({ what = 'Zákazka' }: { what?: string }) {
  return (
    <div className="phone">
      <div className="screen">
        <Blueprint style={{ padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>{what} sa nenašla</h3>
          <p className="muted" style={{ fontSize: 13 }}>Možno bola odstránená alebo je odkaz nesprávny.</p>
          <Link to="/" className="btn btn-secondary">Späť do dielne</Link>
        </Blueprint>
      </div>
    </div>
  )
}
