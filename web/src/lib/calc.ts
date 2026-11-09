import type { LaborBilling, Order, OrderOperation, Part, PartsPricing, PhotoStage, WorkEntry } from './types'
import { dateOf, isoDate } from './format'

export const entrySeconds = (e: WorkEntry, now: number): number =>
  e.ended_at ? e.seconds : Math.max(0, Math.floor((now - Date.parse(e.started_at)) / 1000))

export const runningEntry = (o: Order): WorkEntry | null => o.work_entries.find(e => !e.ended_at) ?? null
export const runningEntryOf = (o: Order, userId: number): WorkEntry | null =>
  o.work_entries.find(e => !e.ended_at && e.user.id === userId) ?? null
export const isRunning = (o: Order): boolean => o.work_entries.some(e => !e.ended_at)
export const isClosed = (o: Order): boolean => o.status === 'unpaid' || o.status === 'done'
/** Paid is final; a closed order waiting for payment can still be corrected. */
export const isPaid = (o: Order): boolean => o.status === 'done'

const STAGE_LABEL: Record<PhotoStage, string> = { pred: 'Pred', pocas: 'Počas', po: 'Po' }

/** Photos added together, labelled by when they were taken (before the work, during it, after closing) and numbered on: "Po 3", "Po 4"… */
export const newPhotos = (o: Order, blobs: Blob[]): { blob: Blob; label: string; stage: PhotoStage }[] => {
  const stage: PhotoStage = isClosed(o) ? 'po' : o.work_entries.length ? 'pocas' : 'pred'
  const n = o.photos.filter(p => p.stage === stage).length + 1
  return blobs.map((blob, i) => ({ blob, label: `${STAGE_LABEL[stage]} ${n + i}`, stage }))
}

export const totalSeconds = (o: Order, now: number): number => o.work_entries.reduce((a, e) => a + entrySeconds(e, now), 0)

/** Today's time by one mechanic on this order: what the big stopwatch shows. */
export const sessionSeconds = (o: Order, userId: number, now: number): number => {
  const today = isoDate(new Date(now))
  return o.work_entries
    .filter(e => e.user.id === userId && dateOf(e.started_at) === today)
    .reduce((a, e) => a + entrySeconds(e, now), 0)
}

export const partCost = (p: Part): number => p.purchase_price ?? p.price

/** Cents to euros, the half cent away from zero, as the server bills it. */
const toEur = (cents: number): number => (Math.sign(cents) * Math.round(Math.abs(cents))) / 100

const halfway = (a: number, b: number): number => toEur((Math.round(a * 100) + Math.round(b * 100)) / 2)

const plus10 = (a: number): number => toEur(Math.round(a * 100) * 11 / 10)

/** Price of a part in the chosen mode; a part without NC falls back to its MOC. */
export const partPrice = (p: Part, mode: PartsPricing): number => {
  if (mode === 'nc') return partCost(p)
  if (mode === 'n10') return p.purchase_price === null ? p.price : plus10(p.purchase_price)
  if (mode === 'mid') return halfway(p.price, partCost(p))
  return p.price
}

/** What the charged parts of an order come to in a mode. */
export const partsAt = (o: Order, mode: PartsPricing): number => o.parts.filter(p => p.used).reduce((a, p) => a + partPrice(p, mode), 0)

export const PRICING_LABEL: Record<PartsPricing, string> = { moc: 'MOC', mid: 'STRED', nc: 'NC', n10: 'NC+10%' }

/** The modes in the order the switches offer them. */
export const PRICING_MODES: PartsPricing[] = ['moc', 'mid', 'nc', 'n10']

export const normSeconds = (o: Order): number => (o.operations ?? []).reduce((a, op) => a + op.norm_minutes * 60, 0)

/** Time clocked against one job of the order, running stints included. */
export const opSeconds = (o: Order, opId: number, now: number): number =>
  o.work_entries.filter(e => e.order_operation_id === opId).reduce((a, e) => a + entrySeconds(e, now), 0)
/** Stints that were not filed under any job. */
export const unassignedEntries = (o: Order): WorkEntry[] => o.work_entries.filter(e => e.order_operation_id === null)
export const opOf = (o: Order, opId: number | null): OrderOperation | null => (opId === null ? null : (o.operations ?? []).find(op => op.id === opId) ?? null)

/** How long the order is planned to take: the explicit plan, else the norm sum, else an hour. */
export const plannedMinutes = (o: Order): number => o.planned_minutes ?? (normSeconds(o) > 0 ? Math.round(normSeconds(o) / 60) : 60)
/** Planned orders first (earliest plan first, so a slipped plan tops the list), the rest by arrival. */
export const byPlan = (a: Order, b: Order): number => {
  if (a.planned_at && b.planned_at) return Date.parse(a.planned_at) - Date.parse(b.planned_at)
  if (a.planned_at !== b.planned_at) return a.planned_at ? -1 : 1
  return (Date.parse(a.received_at ?? '') || 0) - (Date.parse(b.received_at ?? '') || 0)
}

/** An open order whose planned day has passed without being closed: "mešká". */
export const isOverdue = (o: Order, now: number): boolean => {
  if (!o.planned_at || isClosed(o)) return false
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Date.parse(o.planned_at) < today.getTime()
}
/** Planned for today (or slipped from an earlier day) and still open. */
export const isDueToday = (o: Order, now: number): boolean => {
  if (!o.planned_at || isClosed(o)) return false
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return Date.parse(o.planned_at) <= end.getTime()
}

/**
 * The job the big Štart should clock: the only open job, else the job of this mechanic's latest stint
 * on the order when it is still open (a pause continued), else nothing (plain order time).
 */
export const defaultStartOp = (o: Order, userId: number): OrderOperation | null => {
  const open = (o.operations ?? []).filter(op => !op.done)
  if (open.length === 1) return open[0]
  // The most recently logged stint (by id: a manual entry typed in later counts as the latest action, whatever its clock time).
  const last = [...o.work_entries].filter(e => e.user.id === userId).sort((a, b) => b.id - a.id)[0]
  return (last && open.find(op => op.id === last.order_operation_id)) ?? null
}

/** 'norm-ok' while the measured time is within the norm, 'norm-bad' once over it, '' without a norm. */
export const normClass = (seconds: number, norm: number): string => (!norm ? '' : norm - seconds >= 0 ? 'norm-ok' : 'norm-bad')

/** `shopRate` only stands in for an order that does not carry its own rate. */
export function totalsOf(o: Order, shopRate: number, now: number, billing: LaborBilling = 'actual') {
  const rate = o.hourly_rate ?? shopRate
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
  const parts = partsAt(o, o.parts_pricing)
  const parts_margin_adjustment = o.parts_margin_adjustment ?? 0
  return {
    rate, seconds, norm_seconds, delta_seconds: norm_seconds > 0 ? norm_seconds - seconds : null,
    labor, labor_actual, labor_norm, labor_billing: (byNorm ? 'norm' : 'actual') as LaborBilling,
    // A hand-edited total (zľava) wins over the calculated one.
    parts, parts_retail, parts_cost, parts_margin_adjustment, parts_margin: parts - parts_cost + parts_margin_adjustment, grand_computed: labor + parts, grand: o.total_override ?? labor + parts,
  }
}

export const firstName = (name?: string | null): string => (name ? name.split(' ')[0] : '—')

/** "Škoda Octavia III 2.0 TDI" */
export const carName = (car: { make: string; model: string; engine?: string | null }): string => [car.make, car.model, car.engine].filter(Boolean).join(' ')
