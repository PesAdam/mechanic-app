import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TotalEdit from './TotalEdit'
import type { Order } from '../lib/types'

/** TotalEdit reads only the status, the pricing and the two stored totals. */
const orderOf = (o: Partial<Order>) => ({ status: 'open', parts_pricing: 'moc', total_override: null, total_original: null, ...o }) as Order

describe('TotalEdit', () => {
  it('saves a hand-typed total from the pencil', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TotalEdit large order={orderOf({})} grand={16.67} computed={16.67} busy={false} onSave={onSave} />)

    await userEvent.click(screen.getByRole('button', { name: 'Upraviť sumu' }))
    const input = screen.getByRole('textbox', { name: 'Nová suma' })
    expect(input).toHaveValue('16,67')
    await userEvent.clear(input)
    await userEvent.type(input, '15{Enter}')

    expect(onSave).toHaveBeenCalledWith(15)
  })

  it('shows the zľava against the live total on an open order and resets it', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TotalEdit large order={orderOf({ total_override: 15, total_original: 12 })} grand={15} computed={16.67} busy={false} onSave={onSave} />)

    expect(screen.getByText('zľava −1,67 € (10 %)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Vrátiť pôvodnú sumu' }))
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('is read-only once the order is paid and keeps the price it was settled against', () => {
    render(<TotalEdit large order={orderOf({ status: 'done', total_override: 90, total_original: 120 })} grand={90} computed={130} busy={false} onSave={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Upraviť sumu' })).not.toBeInTheDocument()
    expect(screen.getByText('zľava −30,00 € (25 %)')).toBeInTheDocument()
  })

  it('lets a paid order be edited once it is unlocked', () => {
    render(<TotalEdit large locked={false} order={orderOf({ status: 'done' })} grand={90} computed={90} busy={false} onSave={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Upraviť sumu' })).toBeInTheDocument()
  })
})
