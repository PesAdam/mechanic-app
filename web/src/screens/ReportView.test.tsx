import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ReportView from './ReportView'
import type { Order, ReportSettings } from '../lib/types'

const NOW = Date.parse('2026-11-07T10:00:00.000Z')

const settings: ReportSettings = {
  hourly_rate: null, labor_billing: 'actual', report_labor: 'price',
  business: { name: 'Dielňa', owner: '', street: '', city: '', phone: '', email: '', iban: '', ico: '', vat_payer: false },
}

const order = (over: Partial<Order>): Order => ({
  id: 1, number: '0231', status: 'done', parts_pricing: 'moc', total_original: null, total_override: null, parts_margin_adjustment: null, hourly_rate: null, summary: 'Olej', report_note: null, lift: null, received_at: '2026-11-07T08:00:00.000Z', planned_at: null, planned_minutes: null, closed_at: '2026-11-07T09:00:00.000Z', paid_at: null, public_token: 'token-1234',
  customer: { id: 1, name: 'Ján Kováč', phone: null, email: null },
  car: { id: 1, make: 'BMW', model: '1 (F20)', engine: '116d', car_make_id: 1, car_model_id: 1, car_engine_id: 1, logo_url: null, plate: 'ZA 412 KL', vin: null, km: 0 },
  mechanic: null, parts: [], photos: [], diagnostic: null, work_entries: [], operations: [],
  totals: { seconds: 0, norm_seconds: 0, delta_seconds: null, labor: 26.5, labor_actual: 0, labor_norm: 26.5, labor_billing: 'norm', parts: 0, parts_retail: 0, parts_cost: 0, parts_margin_adjustment: 0, parts_margin: 0, parts_pricing: 'moc', grand_computed: 26.5, grand: 26.5 },
  report: { rows: [], period: null },
  ...over,
})

describe('ReportView', () => {
  it('prints the note to the customer with its line breaks', () => {
    render(<ReportView order={order({ report_note: 'Vymenený olej a filter.\nNabudúce skontrolovať brzdy.' })} settings={settings} now={NOW} />)
    expect(screen.getByRole('heading', { name: /Poznámka/ })).toBeInTheDocument()
    expect(screen.getByText(/Nabudúce skontrolovať brzdy\./)).toHaveTextContent('Vymenený olej a filter. Nabudúce skontrolovať brzdy.', { normalizeWhitespace: true })
  })

  it('leaves the note out when it was never filled in', () => {
    render(<ReportView order={order({ report_note: null })} settings={settings} now={NOW} />)
    expect(screen.queryByRole('heading', { name: /Poznámka/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Vykonaná práca/ })).toBeInTheDocument()
  })
})
