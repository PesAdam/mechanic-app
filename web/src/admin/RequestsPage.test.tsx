import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import RequestsPage from './RequestsPage'
import type { ServiceRequest } from '../lib/types'

const REQUEST: ServiceRequest = {
  id: 5, client: { id: 2, name: 'Peter Malý', phone: '+421 905 111 222', email: 'peter@firma.sk' },
  plate: 'ZA 555 XY', make: 'Škoda', model: 'Octavia III', engine: '2.0 TDI', vin: null, km: 182000,
  description: 'Výmena oleja a filtrov', preferred_date: '2026-11-04', photos: [], status: 'new', reject_reason: null,
  created_at: '2026-11-01T10:20:00.000Z', handled_at: null, order: null,
}

const accept = vi.fn().mockResolvedValue(42)
const reject = vi.fn().mockResolvedValue(undefined)
const createInvite = vi.fn().mockResolvedValue({ token: 'tok123', invite: {} })

vi.mock('../data/queries', () => ({
  useServiceRequests: () => ({ data: [REQUEST], isPending: false }),
  useInvites: () => ({ data: { invites: [], clients: [] }, isPending: false }),
  useRequestActions: () => ({ accept, reject, createInvite, revokeInvite: vi.fn(), setClientActive: vi.fn() }),
}))

const page = () => render(
  <MemoryRouter initialEntries={['/admin/poziadavky']}>
    <Routes>
      <Route path="/admin/poziadavky" element={<RequestsPage />} />
      <Route path="/admin/zakazky/:id" element={<div>detail zákazky</div>} />
    </Routes>
  </MemoryRouter>,
)

describe('RequestsPage', () => {
  it('shows who sent what for which car and turns it into an order with one click', async () => {
    const user = userEvent.setup()
    page()

    expect(screen.getByText('ZA 555 XY · Škoda Octavia III 2.0 TDI')).toBeInTheDocument()
    expect(screen.getByText('Peter Malý')).toBeInTheDocument()
    expect(screen.getByText('182 000 km · chce prísť 4. 11. 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Vytvoriť zákazku/ }))

    expect(accept).toHaveBeenCalledWith(5)
    expect(await screen.findByText('detail zákazky')).toBeInTheDocument()
  })

  it('turns a request down with a reason the sender will read', async () => {
    const user = userEvent.setup()
    page()

    await user.click(screen.getByRole('button', { name: /Zamietnuť/ }))
    await user.type(screen.getByLabelText(/Dôvod/), 'Nemáme náradie')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Zamietnuť' }))

    expect(reject).toHaveBeenCalledWith(5, 'Nemáme náradie')
  })

  it('makes a one-time invite link to send', async () => {
    const user = userEvent.setup()
    page()

    await user.click(screen.getByRole('button', { name: /Pozvať človeka/ }))
    await user.type(screen.getByLabelText(/Pre koho/), 'Peter')
    await user.click(screen.getByRole('button', { name: 'Vytvoriť odkaz' }))

    expect(createInvite).toHaveBeenCalledWith('Peter')
    expect(await screen.findByLabelText('Odkaz na registráciu')).toHaveValue(`${window.location.origin}/pozvanka/tok123`)
  })
})
