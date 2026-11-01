import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { UserPlus } from 'lucide-react'
import { ApiError } from '../lib/api'
import Blueprint, { Corners } from '../components/Blueprint'
import { Loading } from '../components/Loading'
import PortalFrame from './PortalFrame'
import { isSignedIn, useInviteCheck, usePortalActions } from './data'

/** /pozvanka/:token — the one-time link: create an account, then straight to sending requests. */
export default function PortalInvite() {
  const { token = '' } = useParams()
  const check = useInviteCheck(token)
  const { register } = usePortalActions()
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (isSignedIn()) return <Navigate to="/portal" replace />
  if (!check.data) return check.isPending ? <Loading text="Overujem pozvánku…" /> : <Invalid />
  if (!check.data.valid) return <Invalid />

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(prev => ({ ...prev, [k]: e.target.value }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await register({ token, name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), password: f.password })
      nav('/portal', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registrácia zlyhala. Skúste to znova.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PortalFrame>
      <div>
        <div className="kicker">Pozvánka</div>
        <h1 style={{ fontSize: 36, margin: 0, lineHeight: 1 }}>{check.data.shop.name}</h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Vytvorte si účet a budete môcť dielni posielať autá a čo na nich treba urobiť. Odkaz funguje len raz.
        </div>
      </div>
      <Blueprint style={{ padding: 18 }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field"><label htmlFor="pi-name">Meno a priezvisko alebo firma</label><input id="pi-name" className="input" autoComplete="name" value={f.name} onChange={set('name')} required maxLength={120} autoFocus /></div>
          <div className="field"><label htmlFor="pi-phone">Telefón</label><input id="pi-phone" className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} required maxLength={32} /></div>
          <div className="field"><label htmlFor="pi-email">E-mail (na prihlásenie)</label><input id="pi-email" className="input" type="email" autoComplete="username" value={f.email} onChange={set('email')} required maxLength={120} /></div>
          <div className="field"><label htmlFor="pi-pass">Heslo (aspoň 8 znakov)</label><input id="pi-pass" className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={8} /></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block blueprint" style={{ minHeight: 48 }} disabled={busy}>
            <Corners /><UserPlus size={16} strokeWidth={1.5} />{busy ? 'Vytváram účet…' : 'Vytvoriť účet'}
          </button>
        </form>
      </Blueprint>
    </PortalFrame>
  )
}

function Invalid() {
  return (
    <PortalFrame>
      <div style={{ margin: 'auto 0' }}>
        <div className="kicker">Pozvánka</div>
        <h1 style={{ fontSize: 32, margin: 0, lineHeight: 1.05 }}>Tento odkaz už neplatí</h1>
        <div className="muted" style={{ fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>
          Pozvánka sa dá použiť len raz a platí 7 dní. Ak ste si účet už vytvorili, <Link to="/portal/prihlasenie">prihláste sa</Link>.
          Inak požiadajte dielňu o nový odkaz.
        </div>
      </div>
    </PortalFrame>
  )
}
