import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, portalToken, token } from './api'

/** The test DOM does not keep localStorage values for this file; an in-memory one stands in. */
const memoryStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('api tokens', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('sends the portal token only to portal calls and the shop token only to the shop', async () => {
    token.set('staff-token')
    portalToken.set('client-token')
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    await api('/orders')
    await api('/portal/requests', { portal: true })

    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer staff-token')
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer client-token')
  })

  it('a refused portal token signs out only the portal', async () => {
    token.set('staff-token')
    portalToken.set('client-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"Unauthenticated."}', { status: 401 })))

    await expect(api('/portal/me', { portal: true })).rejects.toThrow()

    expect(portalToken.get()).toBeNull()
    expect(token.get()).toBe('staff-token')
  })
})
