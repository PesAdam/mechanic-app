import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { LogIn } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'
import Blueprint, { Corners } from '../components/Blueprint'

export default function Login() {
  const { user, login } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const from = (loc.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
      nav(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : navigator.onLine ? 'Prihlásenie zlyhalo. Skúste to znova.' : 'Bez pripojenia na internet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="phone">
      <div className="screen" style={{ justifyContent: 'center', gap: 24 }}>
        <div>
          <div className="kicker">Správa autoopráv</div>
          <h1 style={{ fontSize: 40, margin: 0, lineHeight: 1 }}>Dielňa</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Prihláste sa účtom mechanika.</div>
        </div>
        <Blueprint style={{ padding: 18 }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field"><label htmlFor="li-email">E-mail</label><input id="li-email" className="input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></div>
            <div className="field"><label htmlFor="li-pass">Heslo</label><input id="li-pass" className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block blueprint" style={{ minHeight: 48, fontSize: 15 }} disabled={busy}>
              <Corners /><LogIn size={16} strokeWidth={1.5} />{busy ? 'Prihlasujem…' : 'Prihlásiť sa'}
            </button>
          </form>
        </Blueprint>
      </div>
    </div>
  )
}
