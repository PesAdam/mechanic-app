import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditCarDialog } from './JobDialogs'
import { MAKES, MATCH } from '../test/fixtures'

const updateOrder = vi.fn().mockResolvedValue({})

vi.mock('../data/queries', () => ({
  useCarMakes: () => ({ data: MAKES, isPending: false }),
  useVehicleLookup: () => ({ data: undefined }),
  useOrderActions: () => ({ updateOrder }),
  useUsers: () => ({ data: [] }),
}))

describe('EditCarDialog', () => {
  it('fixes only the engine and keeps make, model, ŠPZ and VIN', async () => {
    const onClose = vi.fn()
    render(<EditCarDialog open onClose={onClose} orderId={9} car={MATCH.car} />)

    await userEvent.click(screen.getByRole('button', { name: '2.0 TDI' }))
    await userEvent.click(screen.getByRole('button', { name: /^1\.6 TDI/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Uložiť' }))

    expect(updateOrder).toHaveBeenCalledWith(9, { car: { make: 'Škoda', model: 'Octavia III', engine: '1.6 TDI', plate: 'ZA 412 KL', vin: 'TMBJG7NE5J0114821' } })
    expect(onClose).toHaveBeenCalled()
  })

  it('switches the model and lets the engine be left out', async () => {
    updateOrder.mockClear()
    render(<EditCarDialog open onClose={() => {}} orderId={9} car={MATCH.car} />)

    await userEvent.click(screen.getByRole('button', { name: 'Octavia III' }))
    await userEvent.click(screen.getByRole('button', { name: /^Fabia III/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Bez motorizácie' }))
    await userEvent.click(screen.getByRole('button', { name: 'Uložiť' }))

    expect(updateOrder).toHaveBeenCalledWith(9, { car: expect.objectContaining({ model: 'Fabia III', engine: null }) })
  })
})
