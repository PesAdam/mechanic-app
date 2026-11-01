import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { LogIn } from 'lucide-react'
import { ApiError } from '../lib/api'
import Blueprint, { Corners } from '../components/Blueprint'
import PortalFrame from './PortalFrame'
import { isSignedIn, usePortalActions } from './data'

export default function PortalLogin() {
  const { login } = usePortalActions()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (isSignedIn()) return <Navigate to="/portal" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
      nav('/portal', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Prihlásenie zlyhalo. Skúste to znova.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PortalFrame>
      <div style={{ marginTop: 'auto' }}>
        <div className="kicker">Požiadavky pre dielňu</div>
        <h1 style={{ fontSize: 36, margin: 0, lineHeight: 1 }}>Prihlásenie</h1>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Účet ste si vytvorili cez pozvánku od dielne.</div>
      </div>
      <Blueprint style={{ padding: 18, marginBottom: 'auto' }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field"><label htmlFor="pl-email">E-mail</label><input id="pl-email" className="input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></div>
          <div className="field"><label htmlFor="pl-pass">Heslo</label><input id="pl-pass" className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block blueprint" style={{ minHeight: 48 }} disabled={busy}>
            <Corners /><LogIn size={16} strokeWidth={1.5} />{busy ? 'Prihlasujem…' : 'Prihlásiť sa'}
          </button>
        </form>
      </Blueprint>
    </PortalFrame>
  )
}
