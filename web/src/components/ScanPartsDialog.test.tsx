import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ScanPartsDialog from './ScanPartsDialog'
import type { OcrWord } from '../lib/partsScan'
import autosave from '../lib/ocr-fixtures/autosave.json'

const addParts = vi.fn()
const readWords = vi.fn()
vi.mock('../data/queries', () => ({ useOrderActions: () => ({ addParts }) }))
// The OCR engine does not run in jsdom; the words it returned for a real Autosave cart stand in.
vi.mock('../lib/ocr', () => ({ readWords: (...args: unknown[]) => readWords(...args) }))

const words = (autosave as [string, number, number, number, number, number][]).map(([text, conf, x0, y0, x1, y1]): OcrWord => ({ text, conf, x0, y0, x1, y1 }))
const screenshot = new File(['png'], 'kosik.png', { type: 'image/png' })

describe('ScanPartsDialog', () => {
  beforeEach(() => {
    addParts.mockReset().mockResolvedValue(undefined)
    readWords.mockReset().mockResolvedValue(words)
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  it('lists the cart rows with prices incl. VAT and adds the ticked ones as MOC', async () => {
    const onClose = vi.fn()
    const { container } = render(<ScanPartsDialog open onClose={onClose} orderId={7} />)

    await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, screenshot)

    const names = await screen.findAllByRole('textbox', { name: 'Názov' })
    expect(names.map(n => (n as HTMLInputElement).value)).toEqual(['Sada brzdových platničiek kotúčovej brzdy', 'Sada brzdových platničiek kotúčovej brzdy', 'Brzdová kvapalina TRW DOT4 1L'])
    expect(screen.getAllByRole('textbox', { name: 'MOC (€)' }).map(n => (n as HTMLInputElement).value)).toEqual(['41,28', '37,87', '15,77'])

    // The brake fluid was two bottles; the second pad set is not needed.
    const metas = screen.getAllByRole('textbox', { name: 'Množstvo · kód' })
    await userEvent.clear(metas[2])
    await userEvent.type(metas[2], '2 ks · PFB401')
    await userEvent.click(screen.getAllByRole('button', { name: /^Pridať: Sada/ })[1])
    await userEvent.click(screen.getByRole('button', { name: 'Pridať 2 diely' }))

    expect(addParts).toHaveBeenCalledWith(7, [
      { name: 'Sada brzdových platničiek kotúčovej brzdy', meta: 'GDB3515', price: 41.28, purchase_price: null },
      { name: 'Brzdová kvapalina TRW DOT4 1L', meta: '2 ks · PFB401', price: 15.77, purchase_price: null },
    ])
    expect(onClose).toHaveBeenCalled()
  })

  it('switches every price to the one without VAT', async () => {
    const { container } = render(<ScanPartsDialog open onClose={vi.fn()} orderId={7} />)
    await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, screenshot)

    await userEvent.click(await screen.findByRole('radio', { name: 'bez DPH' }))

    expect(screen.getAllByRole('textbox', { name: 'MOC (€)' }).map(n => (n as HTMLInputElement).value)).toEqual(['33,56', '30,79', '12,82'])
    expect(screen.getByText('77,17 €')).toBeInTheDocument()
  })

  it('says so when the picture has no priced rows', async () => {
    readWords.mockResolvedValue([])
    const { container } = render(<ScanPartsDialog open onClose={vi.fn()} orderId={7} />)
    await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, screenshot)

    expect(await screen.findByRole('alert')).toHaveTextContent('nenašiel diely s cenou')
    expect(addParts).not.toHaveBeenCalled()
  })
})
