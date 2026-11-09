import { describe, expect, it } from 'vitest'
import { byPlan, carName, entrySeconds, isClosed, isRunning, newPhotos, normClass, opSeconds, partCost, partPrice, plannedMinutes, sessionSeconds, totalsOf, unassignedEntries } from './calc'
import type { Order, Part, WorkEntry } from './types'

const NOW = Date.parse('2026-10-12T10:00:00.000Z')
const user = { id: 1, name: 'Adam Belko' }

const entry = (over: Partial<WorkEntry>): WorkEntry => ({ id: 1, user, order_operation_id: null, started_at: '2026-10-12T08:00:00.000Z', ended_at: '2026-10-12T09:00:00.000Z', seconds: 3600, note: null, manual: false, auto_closed: false, ...over })
const part = (over: Partial<Part>): Part => ({ id: 1, name: 'Diel', meta: null, price: 100, purchase_price: 80, used: true, added_at: '2026-10-12T08:00:00.000Z', ...over })

/** A bare order; tests override what they measure. */
const order = (over: Partial<Order>): Order => ({
  id: 1, number: '0231', status: 'open', parts_pricing: 'moc', total_original: null, total_override: null, parts_margin_adjustment: null, hourly_rate: null, summary: 'Brzdy', report_note: null, lift: null, received_at: null, planned_at: null, planned_minutes: null, closed_at: null, paid_at: null, public_token: 't',
  customer: { id: 1, name: 'Ján Kováč', phone: null, email: null },
  car: { id: 1, make: 'Škoda', model: 'Octavia III', engine: '2.0 TDI', car_make_id: 1, car_model_id: 1, car_engine_id: 1, logo_url: null, plate: 'ZA 412 KL', vin: null, km: 0 },
  mechanic: null, parts: [], photos: [], diagnostic: null, work_entries: [], operations: [],
  totals: { seconds: 0, norm_seconds: 0, delta_seconds: null, labor: 0, labor_actual: 0, labor_norm: 0, labor_billing: 'actual', parts: 0, parts_retail: 0, parts_cost: 0, parts_margin_adjustment: 0, parts_margin: 0, parts_pricing: 'moc', grand_computed: 0, grand: 0 },
  report: { rows: [], period: null },
  ...over,
})

describe('work entries', () => {
  it('counts a finished entry by its stored seconds and a running one from the clock', () => {
    expect(entrySeconds(entry({}), NOW)).toBe(3600)
    const running = entry({ ended_at: null, seconds: 0, started_at: '2026-10-12T09:50:00.000Z' })
    expect(entrySeconds(running, NOW)).toBe(600)
    expect(entrySeconds(running, NOW - 20 * 60_000)).toBe(0)
  })

  it('knows when a stopwatch runs and when an order is closed', () => {
    expect(isRunning(order({ work_entries: [entry({})] }))).toBe(false)
    expect(isRunning(order({ work_entries: [entry({ ended_at: null })] }))).toBe(true)
    expect(isClosed(order({ status: 'open' }))).toBe(false)
    expect(isClosed(order({ status: 'unpaid' }))).toBe(true)
    expect(isClosed(order({ status: 'done' }))).toBe(true)
  })

  it('sums only today and only the given mechanic for the big stopwatch', () => {
    const o = order({ work_entries: [
      entry({ id: 1, seconds: 1000 }),
      entry({ id: 2, seconds: 500, user: { id: 2, name: 'Marek' } }),
      entry({ id: 3, seconds: 700, started_at: '2026-10-11T08:00:00.000Z', ended_at: '2026-10-11T09:00:00.000Z' }),
    ] })
    expect(sessionSeconds(o, 1, NOW)).toBe(1000)
  })
})

describe('totalsOf', () => {
  const o = order({
    work_entries: [entry({ id: 1, seconds: 3600 }), entry({ id: 2, ended_at: null, seconds: 0, started_at: '2026-10-12T09:50:00.000Z' })],
    operations: [{ id: 1, operation_id: 1, name: 'Brzdy vpredu', norm_minutes: 60, done: false, seconds: 0, billed_seconds: 0, amount: 0 }],
    parts: [part({ id: 1, price: 100, purchase_price: 80 }), part({ id: 2, price: 50, purchase_price: null }), part({ id: 3, price: 999, used: false })],
  })

  it('bills actual time by default and keeps the norm comparison', () => {
    const t = totalsOf(o, 30, NOW)
    expect(t.seconds).toBe(4200)
    expect(t.norm_seconds).toBe(3600)
    expect(t.delta_seconds).toBe(-600)
    expect(t.labor_actual).toBeCloseTo(35)
    expect(t.labor_norm).toBeCloseTo(30)
    expect(t.labor).toBeCloseTo(35)
    expect(t.labor_billing).toBe('actual')
  })

  it('bills norm hours when the shop chose that and a norm exists', () => {
    expect(totalsOf(o, 30, NOW, 'norm').labor).toBeCloseTo(30)
    expect(totalsOf(o, 30, NOW, 'norm').labor_billing).toBe('norm')
    // No operations → nothing to bill by, so actual time again.
    const bare = order({ ...o, operations: [] })
    expect(totalsOf(bare, 30, NOW, 'norm').labor_billing).toBe('actual')
  })

  it('counts used parts in MOC and NC, with NC falling back to MOC', () => {
    const t = totalsOf(o, 30, NOW)
    expect(t.parts_retail).toBe(150)
    expect(t.parts_cost).toBe(130)
    expect(t.parts).toBe(150)
    expect(t.grand).toBeCloseTo(185)
    const nc = totalsOf({ ...o, parts_pricing: 'nc' }, 30, NOW)
    expect(nc.parts).toBe(130)
    expect(nc.grand).toBeCloseTo(165)
  })

  it('bills at the rate the order came in with, whatever the shop charges today', () => {
    const t = totalsOf({ ...o, hourly_rate: 25 }, 30, NOW)
    expect(t.rate).toBe(25)
    expect(t.labor).toBeCloseTo(4200 / 3600 * 25)
    expect(totalsOf(o, 30, NOW).rate).toBe(30)
  })

  it('bills stred halfway between MOC and NC in whole cents, a part without NC at its MOC', () => {
    const mid = order({ parts_pricing: 'mid', parts: [part({ id: 1, price: 553.68, purchase_price: 442.68 }), part({ id: 2, price: 10.01, purchase_price: 10 }), part({ id: 3, price: 20, purchase_price: null })] })
    expect(mid.parts.map(p => partPrice(p, 'mid'))).toEqual([498.18, 10.01, 20])
    const t = totalsOf(mid, 30, NOW)
    expect(t.parts).toBeCloseTo(528.19)
    expect(t.parts_margin).toBeCloseTo(55.51)
  })

  it('bills NC+10% as the NC plus a tenth in whole cents, a part without NC at its MOC', () => {
    const n10 = order({ parts_pricing: 'n10', parts: [part({ id: 1, price: 553.68, purchase_price: 442.68 }), part({ id: 2, price: 10.01, purchase_price: 4.45 }), part({ id: 3, price: 20, purchase_price: null })] })
    expect(n10.parts.map(p => partPrice(p, 'n10'))).toEqual([486.95, 4.9, 20])
    const t = totalsOf(n10, 30, NOW)
    expect(t.parts).toBeCloseTo(511.85)
    expect(t.parts_margin).toBeCloseTo(44.72)
  })

  it('takes the owner\'s úprava off the parts margin and never off what the customer pays', () => {
    const t = totalsOf({ ...o, parts_margin_adjustment: -15 }, 30, NOW)
    expect(t.parts_margin).toBe(5)
    expect(t.grand).toBeCloseTo(185)
  })

  it('bills the hand-edited total but keeps the calculated one', () => {
    const o = order({ parts: [part({})], total_original: 100, total_override: 85 })
    const t = totalsOf(o, 30, NOW)
    expect(t.grand_computed).toBe(100)
    expect(t.grand).toBe(85)
    expect(totalsOf({ ...o, total_override: null }, 30, NOW).grand).toBe(100)
  })
})

describe('helpers', () => {
  it('prices a part by mode', () => {
    expect(partPrice(part({}), 'moc')).toBe(100)
    expect(partPrice(part({}), 'nc')).toBe(80)
    expect(partPrice(part({ purchase_price: null }), 'nc')).toBe(100)
    expect(partCost(part({ purchase_price: null }))).toBe(100)
  })

  it('sums the time clocked against one job, running stints included', () => {
    const o = order({
      operations: [{ id: 5, operation_id: 1, name: 'Brzdy', norm_minutes: 60, done: false, seconds: 0, billed_seconds: 0, amount: 0 }],
      work_entries: [entry({ id: 1, order_operation_id: 5 }), entry({ id: 2, order_operation_id: 5, ended_at: null, seconds: 0, started_at: '2026-10-12T09:50:00.000Z' }), entry({ id: 3 })],
    })
    expect(opSeconds(o, 5, NOW)).toBe(4200)
    expect(unassignedEntries(o).map(e => e.id)).toEqual([3])
  })

  it('plans by the explicit duration, else the norms, else an hour', () => {
    expect(plannedMinutes(order({}))).toBe(60)
    expect(plannedMinutes(order({ operations: [{ id: 1, operation_id: null, name: 'X', norm_minutes: 45, done: false, seconds: 0, billed_seconds: 0, amount: 0 }, { id: 2, operation_id: null, name: 'Y', norm_minutes: 30, done: false, seconds: 0, billed_seconds: 0, amount: 0 }] }))).toBe(75)
    expect(plannedMinutes(order({ planned_minutes: 120, operations: [{ id: 1, operation_id: null, name: 'X', norm_minutes: 45, done: false, seconds: 0, billed_seconds: 0, amount: 0 }] }))).toBe(120)
  })

  it('sorts planned orders first, earliest plan first, the rest by arrival', () => {
    const a = order({ id: 1, planned_at: '2026-10-13T08:00:00.000Z' })
    const b = order({ id: 2, planned_at: '2026-10-12T14:00:00.000Z' })
    const c = order({ id: 3, received_at: '2026-10-10T08:00:00.000Z' })
    const d = order({ id: 4, received_at: '2026-10-11T08:00:00.000Z' })
    expect([a, c, d, b].sort(byPlan).map(o => o.id)).toEqual([2, 1, 3, 4])
  })

  it('classifies time against the norm', () => {
    expect(normClass(100, 0)).toBe('')
    expect(normClass(3000, 3600)).toBe('norm-ok')
    expect(normClass(3600, 3600)).toBe('norm-ok')
    expect(normClass(3601, 3600)).toBe('norm-bad')
  })

  it('names a car with or without engine', () => {
    expect(carName({ make: 'Škoda', model: 'Octavia III', engine: '2.0 TDI' })).toBe('Škoda Octavia III 2.0 TDI')
    expect(carName({ make: 'BMW', model: '3 (F30)', engine: null })).toBe('BMW 3 (F30)')
  })
})

describe('newPhotos', () => {
  const blobs = [new Blob(['a']), new Blob(['b'])]
  const after = { id: 9, url: '/storage/po1.jpg', label: 'Po 1', stage: 'po' as const, taken_at: '2026-10-12T12:00:00.000Z' }

  it('labels photos by when they were taken and numbers on from the photos already there', () => {
    expect(newPhotos(order({}), blobs).map(p => p.label)).toEqual(['Pred 1', 'Pred 2'])
    expect(newPhotos(order({ work_entries: [entry({})] }), blobs.slice(0, 1))).toEqual([{ blob: blobs[0], label: 'Počas 1', stage: 'pocas' }])
    expect(newPhotos(order({ status: 'unpaid', photos: [after] }), blobs).map(p => [p.label, p.stage])).toEqual([['Po 2', 'po'], ['Po 3', 'po']])
  })
})
