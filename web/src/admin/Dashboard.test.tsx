import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'
import type { DashboardData } from '../lib/types'

const KPI: DashboardData['kpi'] = {
  earnings: 320, labor: 300, parts_cost: 60, parts_margin: 30, discount: 10, orders: 2,
  pending: { orders: 0, labor: 0, parts_margin: 0, earnings: 0 },
  billed: 380, billed_parts_cost: 60, billed_orders: 2,
  hours: 9, paid: 380, paid_count: 2, due: 0, due_count: 0, norm_hours: 0, efficiency: null,
}
const data: { current: DashboardData } = {
  current: { period: 'week', label: 'Október 2026', rate: 25, kpi: KPI, bars: [], mechanics: [], avg_hours_per_order: 0 },
}

vi.mock('../data/queries', () => ({
  useDashboard: () => ({ data: data.current, isError: false, refetch: vi.fn() }),
  useOrders: () => ({ data: [] }),
  useSettings: () => ({ data: undefined }),
}))
vi.mock('../components/NewJobDialog', () => ({ default: () => null }))

const box = (name: string) => within(screen.getByRole('group', { name }))

describe('Dashboard', () => {
  it('splits zárobok into labor, the parts margin and the two together', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(box('Zárobok z práce').getByText(/300,00/)).toBeInTheDocument()
    expect(box('Zárobok z práce').getByText('z 2 zaplatených zákaziek')).toBeInTheDocument()
    expect(screen.queryByText(/čaká na platbu/)).not.toBeInTheDocument()
    expect(box('Zárobok z dielov').getByText(/^30,00/)).toBeInTheDocument()
    expect(box('Zárobok z dielov').getByText(/účtované 90,00\s€ − nákup 60,00\s€/)).toBeInTheDocument()
    expect(box('Zárobok spolu').getByText(/320,00/)).toBeInTheDocument()
    expect(box('Zárobok spolu').getByText(/práca \+ diely − zľavy 10,00/)).toBeInTheDocument()
  })

  it('shows a total raised by hand as an increase, not a negative discount', () => {
    data.current = { ...data.current, kpi: { ...KPI, earnings: 332.5, discount: -2.5 } }
    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(box('Zárobok spolu').getByText(/práca \+ diely \+ navýšenie 2,50/)).toBeInTheDocument()
  })

  it('counts only paid orders and shows a closed, unpaid one apart as waiting for the money', () => {
    data.current = { ...data.current, kpi: { ...KPI, earnings: 62.5, labor: 62.5, parts_cost: 94.92, parts_margin: 0, discount: 0, orders: 1,
      pending: { orders: 1, labor: 54.17, parts_margin: 0, earnings: 54.17 } } }
    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(box('Zárobok z práce').getByText(/^62,50/)).toBeInTheDocument()
    expect(box('Zárobok z práce').getByText('z 1 zaplatenej zákazky')).toBeInTheDocument()
    expect(box('Zárobok z práce').getByText(/^\+ 54,17\s€ čaká na platbu$/)).toBeInTheDocument()
    expect(box('Zárobok z dielov').queryByText(/čaká na platbu/)).not.toBeInTheDocument()
    expect(box('Zárobok spolu').getByText(/^62,50/)).toBeInTheDocument()
    expect(box('Zárobok spolu').getByText(/\+ 54,17\s€ čaká na platbu · 1 zákazka/)).toBeInTheDocument()
  })

  it('writes a waiting parts loss with a minus, not as "+ -"', () => {
    data.current = { ...data.current, kpi: { ...KPI, pending: { orders: 1, labor: 0.05, parts_margin: -10, earnings: -9.95 } } }
    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(box('Zárobok z dielov').getByText(/^− 10,00\s€ čaká na platbu$/)).toBeInTheDocument()
    expect(box('Zárobok spolu').getByText(/^− 9,95\s€ čaká na platbu · 1 zákazka$/)).toBeInTheDocument()
  })
})
