import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import StatsPage from './StatsPage'
import type { Earnings, StatsData, StatsInsights } from '../lib/types'

const money = (o: Partial<Earnings>): Earnings => ({ orders: 0, billed: 0, labor: 0, parts_billed: 0, parts_cost: 0, parts_adjustment: 0, parts_margin: 0, discount: 0, earnings: 0, hours: 0, per_hour: null, ...o })

const HOURS = Array.from({ length: 14 }, (_, k) => k + 6)
/** October: one paid brake job (2 × the same job, slower than its norm), worked on Monday morning. */
const INSIGHTS: StatsInsights = {
  averages: { order_billed: 85, order_earnings: 55, median_billed: 85, biggest: { id: 8, number: '0007', car: 'Škoda Octavia III', customer: 'Kubišta', billed: 85, earnings: 55 } },
  breakdown: Array.from({ length: 31 }, (_, k) => ({ label: String(k + 1), title: `${k + 1}. 10.`, date: `2026-10-${String(k + 1).padStart(2, '0')}`, labor: k === 20 ? 40 : 0, parts_margin: k === 20 ? 15 : 0, earnings: k === 20 ? 55 : 0, orders: k === 20 ? 1 : 0 })),
  jobs: { categories: [{ key: 'brzdy', labor: 40, jobs: 2 }], top: [{ name: 'Výmena platničiek', count: 2, labor: 40, avg_minutes: 75, norm_minutes: 60 }], norm_hours: 2, actual_hours: 2.5, efficiency: 80 },
  makes: [{ make: 'Škoda', orders: 1, earnings: 55 }],
  customers: { count: 1, new: 0, returning: 1, top: [{ id: 3, name: 'Kubišta', orders: 1, billed: 85, earnings: 55 }] },
  sizes: [{ label: 'do 50 €', count: 0 }, { label: '50–100 €', count: 1 }],
  payment: { avg_days: 1, bands: [{ label: 'v ten deň', count: 0 }, { label: '1–3 dni', count: 1 }], turnaround_days: 0.5 },
  work: {
    hours: 3, mechanics: [{ id: 1, name: 'Peter', hours: 3, orders: 1 }],
    weekdays: ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map((label, k) => ({ label, hours: k === 0 ? 3 : 0 })),
    heatmap: { hours: HOURS, rows: ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'].map((label, k) => ({ label, cells: HOURS.map(h => (k === 0 && (h === 8 || h === 9) ? 1.5 : 0)) })) },
  },
  owed: { count: 1, total: 120, oldest_days: 14, bands: [{ label: 'do 7 dní', count: 0, total: 0 }, { label: '8–30 dní', count: 1, total: 120 }, { label: 'nad 30 dní', count: 0, total: 0 }] },
  year: { label: '2026', previous_label: '2025', months: ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'], current: [0, 0, 0, 0, 0, 0, 0, 0, 65, 120, null, null], previous: [0, 0, 0, 0, 0, 0, 0, 0, 0, 30, 30, 30] },
  requests: { count: 2, accepted: 1, rejected: 1, waiting: 0 },
}

const DATA: StatsData = {
  period: 'month', label: 'Október 2026', start: '2026-10-01', end: '2026-10-31', previous_date: '2026-09-01', next_date: null,
  current: money({ orders: 2, billed: 180, labor: 100, parts_billed: 90, parts_cost: 60, parts_margin: 30, discount: 10, earnings: 120, hours: 4, per_hour: 30 }),
  pending: money({ orders: 1, labor: 40, parts_margin: 5, earnings: 45 }),
  previous: { label: 'September 2026', ...money({ orders: 1, billed: 95, labor: 50, parts_billed: 45, parts_cost: 30, parts_margin: 15, earnings: 65, hours: 2, per_hour: 32.5 }) },
  year_earlier: { label: 'Október 2025', ...money({}) },
  trend: [{ label: 'sep', title: 'September 2026', date: '2026-09-01', ...money({ earnings: 65, parts_cost: 30 }) }, { label: 'okt', title: 'Október 2026', date: '2026-10-01', ...money({ earnings: 120, parts_cost: 60 }) }],
  orders: [{ id: 8, number: '0007', closed_at: '2026-10-20T14:00:00.000Z', paid_at: '2026-10-21T09:00:00.000Z', status: 'done', car: 'Škoda Octavia III', plate: 'BL296XA', customer: 'Kubišta', hours: 2, labor: 50, parts_billed: 45, parts_cost: 30, parts_adjustment: 0, discount: 10, billed: 85, earnings: 55 }],
  insights: INSIGHTS,
}

vi.mock('../data/queries', () => ({ useStats: () => ({ data: DATA, isError: false, refetch: vi.fn() }) }))

describe('StatsPage', () => {
  it('splits zárobok into labor and parts and compares each with the month before', () => {
    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    const total = within(screen.getByRole('group', { name: 'Zárobok spolu' }))
    expect(total.getByText(/120,00/)).toBeInTheDocument()
    expect(total.getByText('▲ +85 %')).toHaveClass('norm-ok')
    const parts = within(screen.getByRole('group', { name: 'Zárobok z dielov' }))
    expect(parts.getByText(/^30,00/)).toBeInTheDocument()
    expect(parts.getByText('▲ +100 %')).toHaveClass('norm-ok')
    expect(within(screen.getByRole('group', { name: 'Zárobok z práce' })).getByText(/^100,00/)).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Zárobok z práce' })).getByText(/^\+ 40,00\s€ čaká na platbu$/)).toBeInTheDocument()
    expect(total.getByText(/\+ 45,00\s€ čaká na platbu · 1 zákazka/)).toBeInTheDocument()
    expect(screen.getByText('Zaplatené zákazky')).toBeInTheDocument()
    expect(screen.getByText('21. 10. 2026')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'September 2026' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Október 2025' })).toBeInTheDocument()
    expect(screen.getByText('Zľavy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nasledujúce obdobie' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeEnabled()
    expect(screen.getByText('Škoda Octavia III')).toBeInTheDocument()
  })

  it('adds what the month was made of: averages, jobs against their norms, when the hours were worked and who still owes', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByText('80 %')).toBeInTheDocument()
    expect(screen.getByText('pomalšie ako norma')).toHaveClass('norm-bad')
    expect(screen.getByText('1 zákazka · najstaršia 14 dní')).toBeInTheDocument()
    expect(screen.getByText('1 prijatá · 1 zamietnutá')).toBeInTheDocument()
    expect(screen.getByText('Brzdy')).toBeInTheDocument()
    expect(screen.getByText('Výmena platničiek')).toBeInTheDocument()
    expect(screen.getByText('Ø 1 h 15 min')).toHaveClass('norm-bad')

    const cell = screen.getByRole('button', { name: 'Po 8:00: 1,5 h' })
    await user.hover(cell)
    expect(screen.getByRole('status')).toHaveTextContent('1 h 30 min')

    const heat = screen.getByText('Kedy sa pracuje').closest('.viz') as HTMLElement
    await user.click(within(heat).getByRole('button', { name: 'Tabuľka' }))
    expect(within(heat).getByRole('columnheader', { name: 'Najviac o' })).toBeInTheDocument()
    expect(within(heat).getByRole('cell', { name: '8:00' })).toBeInTheDocument()
  })
})
