import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PortalHome from './PortalHome'
import type { PortalRequest } from '../lib/types'

const req = (over: Partial<PortalRequest>): PortalRequest => ({
  id: 1, plate: 'ZA 123 AB', make: 'Škoda', model: 'Fabia III', engine: null, vin: null, km: null, description: 'Výmena oleja',
  preferred_date: null, photos: [], created_at: '2026-10-30T09:00:00.000Z', phase: 'sent', reject_reason: null, order: null, ...over,
})

const send = vi.fn()
const cancel = vi.fn()
let REQUESTS: PortalRequest[] = []

vi.mock('./data', () => ({
  isSignedIn: () => true,
  usePortalMe: () => ({ data: { id: 1, name: 'Peter Malý', email: 'p@f.sk', phone: '0905', shop: { name: 'Hôrky', phone: '+421 900 000 000', email: '', street: '', city: '' } } }),
  usePortalRequests: () => ({ data: REQUESTS }),
  usePortalActions: () => ({ send, cancel, logout: vi.fn() }),
}))

describe('PortalHome', () => {
  beforeEach(() => { send.mockReset().mockResolvedValue(undefined); cancel.mockReset() })

  it('shows how far each request got: the order number, the finished report and why one was turned down', () => {
    REQUESTS = [
      req({ id: 3, phase: 'done', order: { number: '0012', planned_at: null, report_token: 'abc' } }),
      req({ id: 2, phase: 'accepted', order: { number: '0011', planned_at: null, report_token: null } }),
      req({ id: 1, phase: 'rejected', reject_reason: 'Nemáme náradie.' }),
    ]
    render(<MemoryRouter><PortalHome /></MemoryRouter>)

    expect(screen.getByText('Hotové')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Zobraziť report/ })).toHaveAttribute('href', '/r/abc')
    expect(screen.getByText(/Zákazka #0011 · termín vám dielňa oznámi/)).toBeInTheDocument()
    expect(screen.getByText('Dielňa: Nemáme náradie.')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Nová požiadavka' })).not.toBeInTheDocument()
  })

  it('sends a car and what to do, offering a car sent before', async () => {
    REQUESTS = [req({ plate: 'BA 777 XY', make: 'Ford', model: 'Focus', engine: '1.6' })]
    const user = userEvent.setup()
    render(<MemoryRouter><PortalHome /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: '+ Nová požiadavka' }))
    const form = within(screen.getByRole('form', { name: 'Nová požiadavka' }))
    await user.click(form.getByRole('button', { name: 'BA 777 XY · Ford Focus' }))
    await user.type(form.getByLabelText('Čo treba urobiť'), 'Pískajú brzdy')
    await user.click(form.getByRole('button', { name: /Odoslať dielni/ }))

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ plate: 'BA 777 XY', make: 'Ford', model: 'Focus', engine: '1.6', description: 'Pískajú brzdy', photos: [] }))
  })

  it('opens the form right away for someone who has not sent anything yet', () => {
    REQUESTS = []
    render(<MemoryRouter><PortalHome /></MemoryRouter>)

    expect(screen.getByRole('form', { name: 'Nová požiadavka' })).toBeInTheDocument()
    expect(screen.getByText('Zatiaľ ste nič neposlali.')).toBeInTheDocument()
  })
})
