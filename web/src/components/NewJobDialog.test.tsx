import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NewJobDialog from './NewJobDialog'
import { lookupFor, MAKES } from '../test/fixtures'
import type { NewOrderPayload, Order } from '../lib/types'

const createOrder = vi.fn(async (_payload: NewOrderPayload) => ({ id: 42 }) as Order)

vi.mock('../data/queries', () => ({
  useCarMakes: () => ({ data: MAKES, isPending: false }),
  useVehicleLookup: (q: string) => ({ data: lookupFor(q) }),
  useOrderActions: () => ({ createOrder }),
}))

describe('NewJobDialog', () => {
  it('cannot be submitted before a vehicle is chosen', () => {
    render(<NewJobDialog open onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Založiť' })).toBeDisabled()
  })

  it('prefills a returning car and customer from the plate and reuses the car on submit', async () => {
    const onClose = vi.fn()
    const onCreated = vi.fn()
    render(<NewJobDialog open onClose={onClose} onCreated={onCreated} />)

    await userEvent.type(screen.getByLabelText('ŠPZ'), 'za 412')
    await userEvent.click(await screen.findByRole('button', { name: 'Použiť' }))

    expect(screen.getByLabelText('ŠPZ')).toHaveValue('ZA 412 KL')
    expect(screen.getByLabelText('VIN')).toHaveValue('TMBJG7NE5J0114821')
    expect(screen.getByLabelText('Zákazník')).toHaveValue('Ján Kováč')
    expect(screen.getByText(/Auto z histórie/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zmeniť vozidlo' })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Čo treba spraviť'), 'Výmena oleja')
    await userEvent.click(screen.getByRole('button', { name: 'Založiť' }))

    expect(createOrder).toHaveBeenCalledWith({
      customer: { name: 'Ján Kováč', phone: '+421 905 123 456' },
      car: { id: 7, make: 'Škoda', model: 'Octavia III', engine: '2.0 TDI', plate: 'ZA 412 KL', vin: 'TMBJG7NE5J0114821', km: 154320 },
      summary: 'Výmena oleja',
    })
    expect(onCreated).toHaveBeenCalledWith(42)
    expect(onClose).toHaveBeenCalled()
  })

  it('takes make and generation from a VIN and continues at the engine', async () => {
    render(<NewJobDialog open onClose={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('ŠPZ'), 'BA 777 XY')
    await userEvent.type(screen.getByLabelText('VIN'), 'TMBJG7NE5J0114821')
    // The VIN of a known car also finds it in the history; pick the decode (second button) on purpose.
    const buttons = await screen.findAllByRole('button', { name: 'Použiť' })
    await userEvent.click(buttons[1])
    expect(screen.getByPlaceholderText('Motorizácia, napr. 2.0 TDI…')).toBeInTheDocument()
    expect(screen.getByTitle('Zmeniť značku')).toHaveTextContent('Škoda')
    expect(screen.getByTitle('Zmeniť model')).toHaveTextContent('Octavia III')
  })
})
