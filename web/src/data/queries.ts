import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, unwrap } from '../lib/api'
import type { CarMake, CodeStatus, VehicleLookup, DashboardData, NewOrderPayload, Operation, Order, OrderStatus, PartsPricing, Period, PhotoStage, Role, Settings, User } from '../lib/types'

export const keys = {
  orders: ['orders'] as const,
  order: (id: number) => ['orders', id] as const,
  users: ['users'] as const,
  settings: ['settings'] as const,
  dashboard: (p: Period) => ['dashboard', p] as const,
  report: (token: string) => ['public-report', token] as const,
  operations: (carModelId?: number | null, carEngineId?: number | null, carMakeId?: number | null) =>
    (carModelId || carEngineId || carMakeId ? (['operations', carModelId ?? 0, carEngineId ?? 0, carMakeId ?? 0] as const) : (['operations'] as const)),
  carMakes: ['car-makes'] as const,
  vehicleLookup: (q: string) => ['vehicle-lookup', q] as const,
}

const LIVE_INTERVAL = 15_000

export function useOrders() {
  return useQuery({
    queryKey: keys.orders,
    queryFn: () => api<{ data: Order[] }>('/orders').then(unwrap),
    refetchInterval: LIVE_INTERVAL,
  })
}

export function useOrder(id: number) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: keys.order(id),
    enabled: Number.isFinite(id) && id > 0,
    queryFn: () => api<{ data: Order }>(`/orders/${id}`).then(unwrap),
    initialData: () => qc.getQueryData<Order[]>(keys.orders)?.find(o => o.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(keys.orders)?.dataUpdatedAt,
    refetchInterval: LIVE_INTERVAL,
  })
}

export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: () => api<{ data: User[] }>('/users').then(unwrap), staleTime: 5 * 60_000 })
}

/** The catalogue; with a car model id every job carries the norm and average for that vehicle. */
export function useOperations(carModelId?: number | null, carEngineId?: number | null, carMakeId?: number | null) {
  const qs = [carModelId ? `car_model_id=${carModelId}` : '', carEngineId ? `car_engine_id=${carEngineId}` : '', carMakeId ? `car_make_id=${carMakeId}` : ''].filter(Boolean).join('&')
  return useQuery({
    queryKey: keys.operations(carModelId, carEngineId, carMakeId),
    queryFn: () => api<{ data: Operation[] }>(`/operations${qs ? `?${qs}` : ''}`).then(unwrap),
    staleTime: 60_000,
  })
}

export function useCarMakes() {
  return useQuery({ queryKey: keys.carMakes, queryFn: () => api<{ data: CarMake[] }>('/car-makes').then(unwrap), staleTime: 5 * 60_000 })
}

/** ŠPZ/VIN typed into the new-order form: known car from the history + VIN decode. Needs at least 3 characters. */
export function useVehicleLookup(q: string) {
  const key = q.replace(/[\s-]+/g, '').toUpperCase()
  return useQuery({
    queryKey: keys.vehicleLookup(key),
    queryFn: () => api<VehicleLookup>(`/vehicles/lookup?q=${encodeURIComponent(key)}`),
    enabled: key.length >= 3,
    staleTime: 60_000,
    placeholderData: prev => prev,
  })
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => api<Settings>('/settings'), staleTime: 5 * 60_000 })
}

export function useDashboard(period: Period) {
  return useQuery({ queryKey: keys.dashboard(period), queryFn: () => api<DashboardData>(`/dashboard?period=${period}`), refetchInterval: 60_000 })
}

export function usePublicReport(token: string) {
  return useQuery({
    queryKey: keys.report(token),
    enabled: token.length > 0,
    queryFn: () => api<{ order: Order; settings: Settings }>(`/public/reports/${encodeURIComponent(token)}`),
  })
}

/** Every write returns the fresh order, which replaces it in both caches. */
export function useOrderActions() {
  const qc = useQueryClient()

  const apply = (o: Order): Order => {
    qc.setQueryData(keys.order(o.id), o)
    qc.setQueryData<Order[]>(keys.orders, list => (list ? list.map(x => (x.id === o.id ? o : x)) : list))
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    return o
  }
  const call = (path: string, init: Parameters<typeof api>[1]) => api<{ data: Order }>(path, init).then(unwrap).then(apply)

  return {
    /** Štart on the order, or on one of its jobs; asking for another job than the running one switches to it. */
    startTimer: (id: number, opts: { order_operation_id?: number | null; note?: string } = {}) => call(`/orders/${id}/timer/start`, { method: 'POST', json: opts }),
    /** Pauza; a job passed here is filed onto a stint that was started without one. */
    stopTimer: (id: number, opts: { order_operation_id?: number } = {}) => call(`/orders/${id}/timer/stop`, { method: 'POST', json: opts }),
    addManual: (id: number, body: { minutes: number; note: string; user_id: number; order_operation_id?: number | null }) =>
      call(`/orders/${id}/work-entries`, { method: 'POST', json: body }),
    /** Priradenie k úkonu after the fact (running or finished stint). */
    updateEntry: (entryId: number, patch: { order_operation_id?: number | null; note?: string | null }) =>
      call(`/work-entries/${entryId}`, { method: 'PATCH', json: patch }),
    addPart: (id: number, part: { name: string; meta: string; price: number; purchase_price: number | null }) => call(`/orders/${id}/parts`, { method: 'POST', json: part }),
    updatePart: (partId: number, patch: { used?: boolean; name?: string; meta?: string; price?: number; purchase_price?: number | null }) =>
      call(`/parts/${partId}`, { method: 'PATCH', json: patch }),
    uploadPhoto: (id: number, p: { blob: Blob; label: string; stage: PhotoStage; photo_id?: number }) => {
      const form = new FormData()
      form.append('image', p.blob, 'photo.jpg')
      form.append('label', p.label)
      form.append('stage', p.stage)
      if (p.photo_id) form.append('photo_id', String(p.photo_id))
      return call(`/orders/${id}/photos`, { method: 'POST', form })
    },
    removePhoto: (photoId: number) => call(`/photos/${photoId}`, { method: 'DELETE' }),
    uploadDiagnostic: (id: number, file: File) => {
      const form = new FormData()
      form.append('file', file, file.name)
      return call(`/orders/${id}/diagnostic`, { method: 'POST', form })
    },
    addCode: (id: number, code: { code: string; description: string; unit: string; status: CodeStatus }) =>
      call(`/orders/${id}/diagnostic/codes`, { method: 'POST', json: code }),
    closeOrder: async (id: number, parts_pricing?: PartsPricing) => {
      const o = await call(`/orders/${id}/close`, { method: 'POST', json: parts_pricing ? { parts_pricing } : {} })
      void qc.invalidateQueries({ queryKey: ['operations'] }) // samples feed the catalogue averages
      return o
    },
    addOperation: (id: number, body: { operation_id: number } | { name: string; norm_minutes: number }) => call(`/orders/${id}/operations`, { method: 'POST', json: body }),
    updateOrderOperation: (opId: number, patch: { done?: boolean; name?: string; norm_minutes?: number }) => call(`/order-operations/${opId}`, { method: 'PATCH', json: patch }),
    removeOrderOperation: (opId: number) => call(`/order-operations/${opId}`, { method: 'DELETE' }),
    updateOrder: (id: number, patch: { status?: OrderStatus; summary?: string; lift?: string | null; mechanic_id?: number | null; parts_pricing?: PartsPricing; total_override?: number | null; planned_at?: string | null; planned_minutes?: number | null; km?: number; customer?: { name?: string; phone?: string | null; email?: string | null } }) =>
      call(`/orders/${id}`, { method: 'PATCH', json: patch }),
    createOrder: async (payload: NewOrderPayload) => {
      const o = await api<{ data: Order }>('/orders', { method: 'POST', json: payload }).then(unwrap)
      qc.setQueryData(keys.order(o.id), o)
      qc.setQueryData<Order[]>(keys.orders, list => (list ? [o, ...list] : [o]))
      return o
    },
  }
}

export function useSettingsActions() {
  const qc = useQueryClient()
  return {
    updateSettings: async (patch: Partial<Pick<Settings, 'hourly_rate' | 'labor_billing' | 'report_show_rate'>> & { business?: Partial<Settings['business']> }) => {
      const s = await api<Settings>('/settings', { method: 'PATCH', json: patch })
      qc.setQueryData(keys.settings, s)
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      return s
    },
  }
}

export interface UserPayload { name: string; email: string; role: Role; password?: string; is_active?: boolean }

/** Owner-only account management plus everyone's own password change. */
export function useUserActions() {
  const qc = useQueryClient()
  const put = (u: User) => {
    qc.setQueryData<User[]>(keys.users, list => (list ? (list.some(x => x.id === u.id) ? list.map(x => (x.id === u.id ? u : x)) : [...list, u]) : [u]))
    return u
  }
  return {
    createUser: (body: UserPayload) => api<{ data: User }>('/users', { method: 'POST', json: body }).then(unwrap).then(put),
    updateUser: (id: number, patch: Partial<UserPayload>) => api<{ data: User }>(`/users/${id}`, { method: 'PATCH', json: patch }).then(unwrap).then(put),
    changePassword: (current_password: string, password: string) =>
      api<{ data: User }>('/auth/password', { method: 'PATCH', json: { current_password, password } }).then(unwrap),
  }
}

export interface OperationPayload { name: string; category: string; norm_minutes: number; is_active?: boolean }

/** Catalogue maintenance. */
export function useOperationActions() {
  const qc = useQueryClient()
  const put = (op: Operation) => {
    qc.setQueryData<Operation[]>(keys.operations(), list => (list ? (list.some(x => x.id === op.id) ? list.map(x => (x.id === op.id ? op : x)) : [...list, op]) : [op]))
    void qc.invalidateQueries({ queryKey: ['operations'], predicate: q => q.queryKey.length > 1 }) // per-car variants
    return op
  }
  return {
    createOperation: (body: OperationPayload) => api<{ data: Operation }>('/operations', { method: 'POST', json: body }).then(unwrap).then(put),
    updateOperation: (id: number, patch: Partial<OperationPayload>) => api<{ data: Operation }>(`/operations/${id}`, { method: 'PATCH', json: patch }).then(unwrap).then(put),
    removeOperation: async (id: number) => {
      const r = await api<{ data: Operation } | undefined>(`/operations/${id}`, { method: 'DELETE' })
      if (r?.data) put(r.data)
      else qc.setQueryData<Operation[]>(keys.operations(), list => list?.filter(x => x.id !== id))
    },
    addNorm: (id: number, body: { car_make_id: number; car_model_id: number | null; car_engine_id: number | null; norm_minutes: number }) =>
      api<{ data: Operation }>(`/operations/${id}/norms`, { method: 'POST', json: body }).then(unwrap).then(put),
    removeNorm: (normId: number) => api<{ data: Operation }>(`/operation-norms/${normId}`, { method: 'DELETE' }).then(unwrap).then(put),
  }
}

/** Značky a modely. */
export function useCarActions() {
  const qc = useQueryClient()
  const put = (m: CarMake) => {
    qc.setQueryData<CarMake[]>(keys.carMakes, list => (list ? (list.some(x => x.id === m.id) ? list.map(x => (x.id === m.id ? m : x)) : [...list, m].sort((a, b) => a.name.localeCompare(b.name, 'sk'))) : [m]))
    return m
  }
  return {
    importDefaults: async () => { const r = await api<{ imported: number; data: CarMake[] }>('/car-makes/import-defaults', { method: 'POST' }); qc.setQueryData(keys.carMakes, r.data); return r.imported },
    createMake: (name: string) => api<{ data: CarMake }>('/car-makes', { method: 'POST', json: { name } }).then(unwrap).then(put),
    renameMake: (id: number, name: string) => api<{ data: CarMake }>(`/car-makes/${id}`, { method: 'PATCH', json: { name } }).then(unwrap).then(put),
    deleteMake: async (id: number) => { await api(`/car-makes/${id}`, { method: 'DELETE' }); qc.setQueryData<CarMake[]>(keys.carMakes, list => list?.filter(x => x.id !== id)) },
    createModel: (makeId: number, name: string) => api<{ data: CarMake }>(`/car-makes/${makeId}/models`, { method: 'POST', json: { name } }).then(unwrap).then(put),
    renameModel: (modelId: number, name: string) => api<{ data: CarMake }>(`/car-models/${modelId}`, { method: 'PATCH', json: { name } }).then(unwrap).then(put),
    deleteModel: (modelId: number) => api<{ data: CarMake }>(`/car-models/${modelId}`, { method: 'DELETE' }).then(unwrap).then(put),
  }
}
