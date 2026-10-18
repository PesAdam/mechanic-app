import type { LaborBilling, Order, OrderOperation, Part, PartsPricing, WorkEntry } from './types'
import { dateOf, isoDate } from './format'

export const entrySeconds = (e: WorkEntry, now: number): number =>
  e.ended_at ? e.seconds : Math.max(0, Math.floor((now - Date.parse(e.started_at)) / 1000))

export const runningEntry = (o: Order): WorkEntry | null => o.work_entries.find(e => !e.ended_at) ?? null
export const runningEntryOf = (o: Order, userId: number): WorkEntry | null =>
  o.work_entries.find(e => !e.ended_at && e.user.id === userId) ?? null
export const isRunning = (o: Order): boolean => o.work_entries.some(e => !e.ended_at)
export const isClosed = (o: Order): boolean => o.status === 'unpaid' || o.status === 'done'

export const totalSeconds = (o: Order, now: number): number => o.work_entries.reduce((a, e) => a + entrySeconds(e, now), 0)

/** Today's time by one mechanic on this order: what the big stopwatch shows. */
export const sessionSeconds = (o: Order, userId: number, now: number): number => {
  const today = isoDate(new Date(now))
  return o.work_entries
    .filter(e => e.user.id === userId && dateOf(e.started_at) === today)
    .reduce((a, e) => a + entrySeconds(e, now), 0)
}

/** Price of a part in the chosen mode; a part without NC falls back to its MOC. */
export const partPrice = (p: Part, mode: PartsPricing): number => (mode === 'nc' ? p.purchase_price ?? p.price : p.price)
export const partCost = (p: Part): number => p.purchase_price ?? p.price

export const normSeconds = (o: Order): number => (o.operations ?? []).reduce((a, op) => a + op.norm_minutes * 60, 0)

/** Time clocked against one job of the order, running stints included. */
export const opSeconds = (o: Order, opId: number, now: number): number =>
  o.work_entries.filter(e => e.order_operation_id === opId).reduce((a, e) => a + entrySeconds(e, now), 0)
/** Stints that were not filed under any job. */
export const unassignedEntries = (o: Order): WorkEntry[] => o.work_entries.filter(e => e.order_operation_id === null)
export const opOf = (o: Order, opId: number | null): OrderOperation | null => (opId === null ? null : (o.operations ?? []).find(op => op.id === opId) ?? null)

/** How long the order is planned to take: the explicit plan, else the norm sum, else an hour. */
export const plannedMinutes = (o: Order): number => o.planned_minutes ?? (normSeconds(o) > 0 ? Math.round(normSeconds(o) / 60) : 60)
/** Planned orders first (earliest plan first), the rest by arrival. */
export const byPlan = (a: Order, b: Order): number => {
  if (a.planned_at && b.planned_at) return Date.parse(a.planned_at) - Date.parse(b.planned_at)
  if (a.planned_at !== b.planned_at) return a.planned_at ? -1 : 1
  return Date.parse(a.received_at ?? '') - Date.parse(b.received_at ?? '')
}

/** 'norm-ok' while the measured time is within the norm, 'norm-bad' once over it, '' without a norm. */
export const normClass = (seconds: number, norm: number): string => (!norm ? '' : norm - seconds >= 0 ? 'norm-ok' : 'norm-bad')

export function totalsOf(o: Order, rate: number, now: number, billing: LaborBilling = 'actual') {
  const seconds = totalSeconds(o, now)
  const norm_seconds = normSeconds(o)
  const labor_actual = (seconds / 3600) * rate
  const labor_norm = (norm_seconds / 3600) * rate
  const byNorm = billing === 'norm' && norm_seconds > 0
  const labor = byNorm ? labor_norm : labor_actual
  const used = o.parts.filter(p => p.used)
  const parts_retail = used.reduce((a, p) => a + p.price, 0)
  const parts_cost = used.reduce((a, p) => a + partCost(p), 0)
  // What the customer pays for parts follows the order's chosen pricing.
  const parts = o.parts_pricing === 'nc' ? parts_cost : parts_retail
  return {
    seconds, norm_seconds, delta_seconds: norm_seconds > 0 ? norm_seconds - seconds : null,
    labor, labor_actual, labor_norm, labor_billing: (byNorm ? 'norm' : 'actual') as LaborBilling,
    // A hand-edited total (zľava) wins over the calculated one.
    parts, parts_retail, parts_cost, grand_computed: labor + parts, grand: o.total_override ?? labor + parts,
  }
}

export const firstName = (name?: string | null): string => (name ? name.split(' ')[0] : '—')

/** "Škoda Octavia III 2.0 TDI" */
export const carName = (car: { make: string; model: string; engine?: string | null }): string => [car.make, car.model, car.engine].filter(Boolean).join(' ')
