import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { api, setUnauthorizedHandler, token } from '../lib/api'
import type { User } from '../lib/types'

interface AuthContextValue {
  user: User | null
  /** False until the stored token has been checked against the API. */
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const USER_KEY = 'mechanic-app:user'

const readUser = (): User | null => {
  try { const raw = localStorage.getItem(USER_KEY); return raw ? (JSON.parse(raw) as User) : null } catch { return null }
}
const writeUser = (u: User | null): void => {
  try { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY) } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  // Start from the remembered user so the app opens instantly (and offline); verify in the background.
  const [user, setUser] = useState<User | null>(() => (token.get() ? readUser() : null))
  const [ready, setReady] = useState(() => !token.get())

  const clear = useCallback(() => {
    token.set(null)
    writeUser(null)
    setUser(null)
    qc.clear()
  }, [qc])

  useEffect(() => {
    setUnauthorizedHandler(() => { writeUser(null); setUser(null); qc.clear() })
    return () => setUnauthorizedHandler(null)
  }, [qc])

  useEffect(() => {
    if (!token.get()) return
    let cancelled = false
    api<{ data: User }>('/auth/me')
      .then(r => { if (!cancelled) { setUser(r.data); writeUser(r.data) } })
      .catch(() => { /* 401 is handled by the api client; network errors keep the remembered user */ })
      .finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      json: { email, password, device_name: navigator.userAgent.slice(0, 60) },
    })
    token.set(r.token)
    writeUser(r.user)
    setUser(r.user)
    setReady(true)
  }, [])

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }) } catch { /* token may already be gone */ }
    clear()
  }, [clear])

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const c = useContext(AuthContext)
  if (!c) throw new Error('useAuth must be used inside AuthProvider')
  return c
}

/** Layout route: renders children only for a signed-in mechanic. */
export function RequireAuth() {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!user) {
    if (!ready) return null
    return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  }
  return <Outlet />
}

/** The desktop zone belongs to the owner; a mechanic lands back in the phone app. */
export function RequireOwner({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user?.role !== 'owner') return <Navigate to="/m" replace />
  return <>{children}</>
}
