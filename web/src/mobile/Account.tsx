import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, KeyRound, LogOut, Monitor } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { firstName } from '../lib/calc'
import Blueprint from '../components/Blueprint'
import PasswordDialog from '../components/PasswordDialog'

/** Môj účet — who am I, change my password, sign out. Accounts themselves are managed on the desktop. */
export default function Account() {
  const { user, logout } = useAuth()
  const [pwOpen, setPwOpen] = useState(false)
  const owner = user?.role === 'owner'
  return (
    <div className="phone">
      <div className="screen" style={{ gap: 16 }}>
        <div className="screen-head">
          <Link to="/m" className="back" aria-label="Späť do dielne"><ChevronLeft size={20} strokeWidth={1.5} /><span className="hd" style={{ fontSize: 18 }}>Dielňa</span></Link>
        </div>
        <div>
          <div className="kicker">Môj účet</div>
          <h1 style={{ fontSize: 40, margin: 0, lineHeight: 1 }}>{firstName(user?.name)}</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{user?.name} · {user?.email}</div>
        </div>
        <Blueprint className="card" style={{ padding: 14, gap: 6 }}>
          <span className="card-kicker">Rola</span>
          <span className={owner ? 'tag tag-accent' : 'tag tag-neutral'} style={{ alignSelf: 'flex-start' }}>{owner ? 'Majiteľ' : 'Mechanik'}</span>
          {!owner && <div className="muted" style={{ fontSize: 12 }}>Účty a nastavenia spravuje majiteľ v desktopovej verzii.</div>}
        </Blueprint>
        <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setPwOpen(true)}><KeyRound size={16} strokeWidth={1.5} />Zmeniť heslo</button>
        {owner && <Link to="/admin" className="btn btn-secondary" style={{ minHeight: 44 }}><Monitor size={16} strokeWidth={1.5} />Otvoriť web pre majiteľa</Link>}
        <button className="btn btn-ghost" style={{ marginTop: 'auto', minHeight: 44 }} onClick={() => void logout()}><LogOut size={16} strokeWidth={1.5} />Odhlásiť sa</button>
      </div>
      <PasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}
