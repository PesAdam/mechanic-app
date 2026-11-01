/** Thin fetch wrapper for the Laravel API: bearer token, JSON/multipart bodies, typed errors. */

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`
const TOKEN_KEY = 'mechanic-app:token'

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

const tokenStore = (key: string) => ({
  get(): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(value: string | null): void {
    try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key) } catch { /* private mode */ }
  },
})

export const token = tokenStore(TOKEN_KEY)
/** The portal's own sign-in: a client and the shop never share a token, even on one device. */
export const portalToken = tokenStore('mechanic-app:portal-token')

let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: (() => void) | null): void => { onUnauthorized = fn }

interface Options extends Omit<RequestInit, 'body'> {
  json?: unknown
  form?: FormData
  /** Sends the portal client's token instead of the shop's. */
  portal?: boolean
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { json, form, portal, headers: extra, ...init } = options
  const headers: Record<string, string> = { Accept: 'application/json', ...(extra as Record<string, string> | undefined) }
  const store = portal ? portalToken : token
  const t = store.get()
  if (t) headers.Authorization = `Bearer ${t}`

  let body: BodyInit | undefined
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form
  }

  const res = await fetch(BASE + path, { ...init, headers, body })
  if (res.status === 204) return undefined as T

  const data = (await res.json().catch(() => null)) as { message?: string; errors?: Record<string, string[]> } | null
  if (!res.ok) {
    if (res.status === 401) {
      store.set(null)
      if (!portal) onUnauthorized?.()
    }
    const message = data?.errors ? Object.values(data.errors).flat()[0] ?? data.message : data?.message
    throw new ApiError(res.status, message || `Chyba servera (${res.status})`, data?.errors)
  }
  return data as T
}

/** Laravel wraps resources in `data`. */
export const unwrap = <T,>(r: { data: T }): T => r.data
