import { describe, expect, it } from 'vitest'
import { byPlan, carName, entrySeconds, isClosed, isRunning, normClass, opSeconds, partCost, partPrice, plannedMinutes, sessionSeconds, totalsOf, unassignedEntries } from './calc'
import type { Order, Part, WorkEntry } from './types'

const NOW = Date.parse('2026-10-12T10:00:00.000Z')
const user = { id: 1, name: 'Adam Belko' }

const entry = (over: Partial<WorkEntry>): WorkEntry => ({ id: 1, user, order_operation_id: null, started_at: '2026-10-12T08:00:00.000Z', ended_at: '2026-10-12T09:00:00.000Z', seconds: 3600, note: null, manual: false, ...over })
const part = (over: Partial<Part>): Part => ({ id: 1, name: 'Diel', meta: null, price: 100, purchase_price: 80, used: true, added_at: '2026-10-12T08:00:00.000Z', ...over })

/** A bare order; tests override what they measure. */
const order = (over: Partial<Order>): Order => ({
  id: 1, number: '0231', status: 'open', parts_pricing: 'moc', total_original: null, total_override: null, summary: 'Brzdy', lift: null, received_at: null, planned_at: null, planned_minutes: null, closed_at: null, public_token: 't',
  customer: { id: 1, name: 'Ján Kováč', phone: null, email: null },
  car: { id: 1, make: 'Škoda', model: 'Octavia III', engine: '2.0 TDI', car_make_id: 1, car_model_id: 1, car_engine_id: 1, logo_url: null, plate: 'ZA 412 KL', vin: null, km: 0 },
  mechanic: null, parts: [], photos: [], diagnostic: null, work_entries: [], operations: [],
  totals: { seconds: 0, norm_seconds: 0, delta_seconds: null, labor: 0, labor_actual: 0, labor_norm: 0, labor_billing: 'actual', parts: 0, parts_retail: 0, parts_cost: 0, parts_pricing: 'moc', grand_computed: 0, grand: 0 },
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
