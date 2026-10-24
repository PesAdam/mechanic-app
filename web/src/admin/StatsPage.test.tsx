import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import StatsPage from './StatsPage'
import type { Earnings, StatsData } from '../lib/types'

const money = (o: Partial<Earnings>): Earnings => ({ orders: 0, billed: 0, labor: 0, parts_billed: 0, parts_cost: 0, parts_margin: 0, discount: 0, earnings: 0, hours: 0, per_hour: null, ...o })

const DATA: StatsData = {
  period: 'month', label: 'Október 2026', start: '2026-10-01', end: '2026-10-31', previous_date: '2026-09-01', next_date: null,
  current: money({ orders: 2, billed: 180, labor: 100, parts_billed: 90, parts_cost: 60, parts_margin: 30, discount: 10, earnings: 120, hours: 4, per_hour: 30 }),
  previous: { label: 'September 2026', ...money({ orders: 1, billed: 95, labor: 50, parts_billed: 45, parts_cost: 30, parts_margin: 15, earnings: 65, hours: 2, per_hour: 32.5 }) },
  year_earlier: { label: 'Október 2025', ...money({}) },
  trend: [{ label: 'sep', title: 'September 2026', date: '2026-09-01', ...money({ earnings: 65, parts_cost: 30 }) }, { label: 'okt', title: 'Október 2026', date: '2026-10-01', ...money({ earnings: 120, parts_cost: 60 }) }],
  orders: [{ id: 8, number: '0007', closed_at: '2026-10-20T14:00:00.000Z', status: 'done', car: 'Škoda Octavia III', plate: 'BL296XA', customer: 'Kubišta', hours: 2, labor: 50, parts_billed: 45, parts_cost: 30, discount: 10, billed: 85, earnings: 55 }],
}

vi.mock('../data/queries', () => ({ useStats: () => ({ data: DATA, isError: false, refetch: vi.fn() }) }))

describe('StatsPage', () => {
  it('shows zárobok without parts and how it compares with the month before', () => {
    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    const kpi = screen.getByText('Zárobok · bez dielov').parentElement as HTMLElement
    expect(within(kpi).getByText(/120,00/)).toBeInTheDocument()
    expect(within(kpi).getByText('▲ +85 %')).toHaveClass('norm-ok')
    expect(screen.getByRole('columnheader', { name: 'September 2026' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Október 2025' })).toBeInTheDocument()
    expect(screen.getByText('Zľavy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nasledujúce obdobie' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeEnabled()
    expect(screen.getByText('Škoda Octavia III')).toBeInTheDocument()
  })
})
