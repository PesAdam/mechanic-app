import { useState, type FormEvent } from 'react'
import Dialog from './Dialog'
import { useUserActions } from '../data/queries'
import { ApiError } from '../lib/api'

export default function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { changePassword } = useUserActions()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== again) { setError('Nové heslá sa nezhodujú.'); return }
    setBusy(true)
    setError(null)
    try {
      await changePassword(current, next)
      setCurrent(''); setNext(''); setAgain('')
      setDone(true)
      setTimeout(() => { setDone(false); onClose() }, 900)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nepodarilo sa zmeniť heslo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title="Zmeniť heslo" onClose={onClose}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Zrušiť</button><button type="submit" form="change-password" className="btn btn-primary" disabled={busy}>{done ? 'Zmenené ✓' : busy ? 'Ukladám…' : 'Zmeniť'}</button></>}>
      <form id="change-password" onSubmit={submit}>
        <div className="field"><label htmlFor="cp-current">Súčasné heslo</label><input id="cp-current" className="input" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required autoFocus /></div>
        <div className="row">
          <div className="field"><label htmlFor="cp-next">Nové heslo</label><input id="cp-next" className="input" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} minLength={8} required /></div>
          <div className="field"><label htmlFor="cp-again">Znova</label><input id="cp-again" className="input" type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} minLength={8} required /></div>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  )
}
