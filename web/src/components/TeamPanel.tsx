import { useState, type FormEvent } from 'react'
import { KeyRound, UserPlus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useUserActions, useUsers, type UserPayload } from '../data/queries'
import { ApiError } from '../lib/api'
import type { Role, User } from '../lib/types'
import Blueprint, { Corners } from './Blueprint'
import Dialog from './Dialog'
import PasswordDialog from './PasswordDialog'
import { LoadError } from './Loading'

/** Accounts of the workshop: the owner adds, edits, resets passwords and deactivates. */
export default function TeamPanel() {
  const { user } = useAuth()
  const users = useUsers()
  const [editing, setEditing] = useState<User | null>(null)
  const [creating, setCreating] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const isOwner = user?.role === 'owner'
  const list = users.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
      {users.isError && !list.length && <LoadError text="Tím sa nepodarilo načítať." onRetry={() => void users.refetch()} />}
      {users.isPending && !list.length && <Blueprint style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>Načítavam…</div></Blueprint>}

      {list.map(u => (
        <Blueprint key={u.id} className="card" style={{ padding: 14, gap: 6, opacity: u.is_active ? 1 : 0.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="card-title">{u.name}{u.id === user?.id ? ' (ja)' : ''}</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className={u.role === 'owner' ? 'tag tag-accent' : 'tag tag-neutral'}>{u.role === 'owner' ? 'Majiteľ' : 'Mechanik'}</span>
              {!u.is_active && <span className="tag tag-outline">Neaktívny</span>}
              {isOwner && <button className="btn btn-secondary" style={{ minHeight: 32 }} onClick={() => setEditing(u)}>Upraviť</button>}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{u.email}</div>
        </Blueprint>
      ))}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {isOwner && (
          <button className="btn btn-primary blueprint" style={{ minHeight: 40 }} onClick={() => setCreating(true)}>
            <Corners /><UserPlus size={16} strokeWidth={1.5} />Pridať kolegu
          </button>
        )}
        <button className="btn btn-secondary" style={{ minHeight: 40 }} onClick={() => setPasswordOpen(true)}><KeyRound size={16} strokeWidth={1.5} />Zmeniť si heslo</button>
      </div>

      <UserDialog open={creating} onClose={() => setCreating(false)} />
      <UserDialog open={!!editing} onClose={() => setEditing(null)} user={editing ?? undefined} isSelf={editing?.id === user?.id} />
      <PasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}

function UserDialog({ open, onClose, user, isSelf }: { open: boolean; onClose: () => void; user?: User; isSelf?: boolean }) {
  const { createUser, updateUser } = useUserActions()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'mechanic')
  const [active, setActive] = useState(user?.is_active ?? true)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seeded, setSeeded] = useState<number | 'new' | null>(null)

  // Re-seed the fields whenever a different user is opened.
  const key = user?.id ?? 'new'
  if (open && seeded !== key) {
    setSeeded(key)
    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
    setRole(user?.role ?? 'mechanic')
    setActive(user?.is_active ?? true)
    setPassword('')
    setError(null)
  }
  if (!open && seeded !== null) setSeeded(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body: UserPayload = { name: name.trim(), email: email.trim(), role, is_active: active }
      if (password) body.password = password
      if (user) await updateUser(user.id, body)
      else await createUser({ ...body, password })
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nepodarilo sa uložiť.')
    } finally {
      setBusy(false)
    }
  }

  const formId = user ? `user-${user.id}` : 'user-new'
  return (
    <Dialog open={open} title={user ? 'Upraviť účet' : 'Nový kolega'} onClose={onClose}
      actions={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Zrušiť</button><button type="submit" form={formId} className="btn btn-primary" disabled={busy}>{busy ? 'Ukladám…' : 'Uložiť'}</button></>}>
      <form id={formId} onSubmit={submit}>
        <div className="field"><label htmlFor={`${formId}-name`}>Meno</label><input id={`${formId}-name`} className="input" value={name} onChange={e => setName(e.target.value)} required autoFocus /></div>
        <div className="field"><label htmlFor={`${formId}-email`}>E-mail (prihlasovacie meno)</label><input id={`${formId}-email`} className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <div className="row">
          <div className="field"><label htmlFor={`${formId}-role`}>Rola</label>
            <select id={`${formId}-role`} className="input" value={role} onChange={e => setRole(e.target.value as Role)} disabled={isSelf}>
              <option value="mechanic">Mechanik</option><option value="owner">Majiteľ</option>
            </select>
          </div>
          <div className="field"><label htmlFor={`${formId}-pass`}>{user ? 'Nové heslo (voliteľné)' : 'Heslo'}</label><input id={`${formId}-pass`} className="input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required={!user} placeholder="aspoň 8 znakov" /></div>
        </div>
        {user && !isSelf && (
          <label className="radio" style={{ gap: 10 }}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} style={{ position: 'static', opacity: 1, width: 16, height: 16, pointerEvents: 'auto' }} />
            Účet je aktívny (neaktívny sa nevie prihlásiť)
          </label>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  )
}
