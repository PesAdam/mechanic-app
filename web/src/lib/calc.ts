import type { LaborBilling, Order, Part, PartsPricing, WorkEntry } from './types'
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
    parts, parts_retail, parts_cost, grand: labor + parts,
  }
}

export const firstName = (name?: string | null): string => (name ? name.split(' ')[0] : '—')

/** "Škoda Octavia III 2.0 TDI" */
export const carName = (car: { make: string; model: string; engine?: string | null }): string => [car.make, car.model, car.engine].filter(Boolean).join(' ')
