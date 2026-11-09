import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MarginEdit from './MarginEdit'

describe('MarginEdit', () => {
  it('saves the margin the owner keeps as the difference from the calculated one', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<MarginEdit computed={111} adjustment={null} busy={false} onSave={onSave} />)

    await userEvent.click(screen.getByRole('button', { name: 'Upraviť maržu' }))
    const input = screen.getByRole('textbox', { name: 'Nová marža' })
    expect(input).toHaveValue('111,00')
    await userEvent.clear(input)
    await userEvent.type(input, '61{Enter}')

    expect(onSave).toHaveBeenCalledWith(-50)
  })

  it('shows what went to someone else and goes back to the calculated margin', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<MarginEdit computed={111} adjustment={-50} busy={false} onSave={onSave} />)

    expect(screen.getByText('61,00 €')).toBeInTheDocument()
    expect(screen.getByText('odvod −50,00 €')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Vrátiť vypočítanú maržu' }))
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('stores nothing when the calculated margin is typed back', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<MarginEdit computed={111} adjustment={-50} busy={false} onSave={onSave} />)

    await userEvent.click(screen.getByRole('button', { name: 'Upraviť maržu' }))
    const input = screen.getByRole('textbox', { name: 'Nová marža' })
    await userEvent.clear(input)
    await userEvent.type(input, '111{Enter}')

    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('is read-only on a locked order', () => {
    render(<MarginEdit computed={111} adjustment={-50} busy={false} locked onSave={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Upraviť maržu' })).not.toBeInTheDocument()
    expect(screen.getByText('odvod −50,00 €')).toBeInTheDocument()
  })
})
