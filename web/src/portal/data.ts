import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, portalToken, unwrap } from '../lib/api'
import type { PortalClient, PortalRequest, Shop } from '../lib/types'

/** Everything the portal caches lives under 'portal', so signing out drops it in one go. */
export const portalKeys = {
  all: ['portal'] as const,
  me: ['portal', 'me'] as const,
  requests: ['portal', 'requests'] as const,
  invite: (token: string) => ['portal', 'invite', token] as const,
}

export const isSignedIn = () => !!portalToken.get()

export function usePortalMe() {
  return useQuery({
    queryKey: portalKeys.me,
    enabled: isSignedIn(),
    retry: false,
    queryFn: () => api<{ client: PortalClient }>('/portal/me', { portal: true }).then(r => r.client),
  })
}

export function usePortalRequests() {
  return useQuery({
    queryKey: portalKeys.requests,
    enabled: isSignedIn(),
    refetchInterval: 60_000,
    queryFn: () => api<{ data: PortalRequest[] }>('/portal/requests', { portal: true }).then(unwrap),
  })
}

/** Whether an invite link still works, asked before the form is shown. */
export function useInviteCheck(token: string) {
  return useQuery({
    queryKey: portalKeys.invite(token),
    retry: false,
    queryFn: () => api<{ valid: boolean; shop: Shop }>(`/portal/invites/${encodeURIComponent(token)}`, { portal: true }),
  })
}

export interface Registration { token: string; name: string; phone: string; email: string; password: string }
export interface NewRequest { plate: string; make: string; model: string; engine: string; vin: string; km: string; description: string; preferred_date: string; photos: Blob[] }

export function usePortalActions() {
  const qc = useQueryClient()
  const signedIn = (r: { token: string; client: PortalClient }) => {
    portalToken.set(r.token)
    qc.setQueryData(portalKeys.me, r.client)
    void qc.invalidateQueries({ queryKey: portalKeys.requests })
    return r.client
  }
  return {
    register: (body: Registration) => api<{ token: string; client: PortalClient }>('/portal/register', { method: 'POST', json: body, portal: true }).then(signedIn),
    login: (email: string, password: string) =>
      api<{ token: string; client: PortalClient }>('/portal/login', { method: 'POST', json: { email, password }, portal: true }).then(signedIn),
    logout: async () => {
      await api('/portal/logout', { method: 'POST', portal: true }).catch(() => undefined)
      portalToken.set(null)
      qc.removeQueries({ queryKey: portalKeys.all })
    },
    send: async (r: NewRequest) => {
      const form = new FormData()
      for (const key of ['plate', 'make', 'model', 'engine', 'vin', 'description', 'preferred_date'] as const) form.append(key, r[key].trim())
      form.append('km', r.km.replace(/\D/g, '')) // "154 000" or "154.000" as typed
      r.photos.forEach((blob, i) => form.append('photos[]', blob, `foto-${i + 1}.jpg`))
      const sent = await api<{ data: PortalRequest }>('/portal/requests', { method: 'POST', form, portal: true }).then(unwrap)
      qc.setQueryData<PortalRequest[]>(portalKeys.requests, list => [sent, ...(list ?? [])])
      return sent
    },
    cancel: async (id: number) => {
      await api(`/portal/requests/${id}`, { method: 'DELETE', portal: true })
      qc.setQueryData<PortalRequest[]>(portalKeys.requests, list => list?.filter(r => r.id !== id))
    },
  }
}
