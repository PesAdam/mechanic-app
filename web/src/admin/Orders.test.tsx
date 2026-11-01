import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import Orders from './Orders'
import type { Order } from '../lib/types'

const order = (over: Partial<Order>): Order => ({
  id: 1, number: '0231', status: 'open', parts_pricing: 'moc', total_original: null, total_override: null, summary: 'Brzdy', lift: null, received_at: null, planned_at: null, planned_minutes: null, closed_at: null, paid_at: null, public_token: 't',
  customer: { id: 1, name: 'Ján Kováč', phone: null, email: null },
  car: { id: 1, make: 'Škoda', model: 'Octavia III', engine: '2.0 TDI', car_make_id: 1, car_model_id: 1, car_engine_id: 1, logo_url: null, plate: 'ZA 412 KL', vin: null, km: 0 },
  mechanic: null, parts: [], photos: [], diagnostic: null, work_entries: [], operations: [],
  totals: { seconds: 0, norm_seconds: 0, delta_seconds: null, labor: 0, labor_actual: 0, labor_norm: 0, labor_billing: 'actual', parts: 0, parts_retail: 0, parts_cost: 0, parts_pricing: 'moc', grand_computed: 0, grand: 0 },
  report: { rows: [], period: null },
  ...over,
})

// As the API sends them: newest received first. 0004 came in early but was finished last; 0002 was paid long after closing.
const ORDERS = [
  order({ id: 11, number: '0011', received_at: '2026-10-28T08:00:00.000Z' }),
  order({ id: 10, number: '0010', status: 'done', received_at: '2026-10-22T08:00:00.000Z', closed_at: '2026-10-22T15:00:00.000Z', paid_at: '2026-10-23T09:00:00.000Z' }),
  order({ id: 4, number: '0004', status: 'done', received_at: '2026-10-19T08:00:00.000Z', closed_at: '2026-10-28T15:00:00.000Z', paid_at: '2026-10-28T16:00:00.000Z' }),
  order({ id: 2, number: '0002', status: 'done', received_at: '2026-10-13T08:00:00.000Z', closed_at: '2026-10-14T15:00:00.000Z', paid_at: '2026-10-25T10:00:00.000Z' }),
]

vi.mock('../data/queries', () => ({
  useOrders: () => ({ data: ORDERS, isPending: false }),
  useSettings: () => ({ data: undefined }),
}))
vi.mock('../components/NewJobDialog', () => ({ default: () => null }))

const numbers = () => screen.getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[0].textContent)

describe('Orders', () => {
  it('lists paid orders by the day the money came in, newest first, and can sort them by closing or receiving', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Orders /></MemoryRouter>)
    expect(screen.queryByRole('columnheader', { name: 'Uzavreté' })).not.toBeInTheDocument()

    await user.click(screen.getByText('Uhradené'))

    expect(screen.getByRole('radio', { name: 'Podľa úhrady' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'Podľa plánu' })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Uzavreté' })).toBeInTheDocument()
    expect(numbers()).toEqual(['0004', '0002', '0010'])
    expect(screen.getAllByText(/^uhradené /)).toHaveLength(3)

    await user.click(screen.getByText('Podľa uzavretia'))
    expect(numbers()).toEqual(['0004', '0010', '0002'])

    await user.click(screen.getByText('Podľa prijatia'))
    expect(numbers()).toEqual(['0010', '0004', '0002'])
  })

  it('goes back to the received order for open orders, where nothing is closed yet', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><Orders /></MemoryRouter>)

    await user.click(screen.getByText('Uhradené'))
    await user.click(screen.getByText('Otvorené'))

    expect(screen.getByRole('radio', { name: 'Podľa prijatia' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'Podľa uzavretia' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Podľa úhrady' })).not.toBeInTheDocument()
    expect(numbers()).toEqual(['0011'])
  })
})
