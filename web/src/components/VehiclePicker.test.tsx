import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import VehiclePicker, { EMPTY_VEHICLE, type Stage, type VehicleValue } from './VehiclePicker'
import { lookupFor, MAKES } from '../test/fixtures'

vi.mock('../data/queries', () => ({
  useCarMakes: () => ({ data: MAKES, isPending: false }),
  useVehicleLookup: (q: string) => ({ data: lookupFor(q) }),
}))

/** The picker is controlled; this holds the value like a form would. */
function Harness({ initial = EMPTY_VEHICLE, onChange, optionalLevels, startAt, lookup }: { initial?: VehicleValue; onChange: (v: VehicleValue) => void; optionalLevels?: boolean; startAt?: Stage; lookup?: boolean }) {
  const [value, setValue] = useState(initial)
  return <VehiclePicker value={value} onChange={v => { setValue(v); onChange(v) }} optionalLevels={optionalLevels} startAt={startAt} lookup={lookup} />
}

describe('VehiclePicker', () => {
  it('lists makes by how often they were worked on, then walks make → model → engine', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    // The accessible name skips the decorative logo: "Škoda" + usage badge.
    const tiles = screen.getAllByRole('button').filter(b => b.className === 'make-tile')
    expect(tiles.map(t => t.querySelector('span:not([aria-hidden])')?.textContent)).toEqual(['Škoda', 'Volkswagen'])
    expect(tiles.map(t => t.querySelector('.make-count')?.textContent)).toEqual(['3×', '1×'])

    await userEvent.click(tiles[0])
    expect(screen.getByPlaceholderText('Model Škoda…')).toBeInTheDocument()
    const rows = screen.getAllByRole('button').filter(b => b.className === 'op-pick')
    expect(rows[0]).toHaveTextContent('Octavia III')
    expect(rows[0]).toHaveTextContent('2012–2020')

    await userEvent.click(rows[0])
    expect(screen.getByPlaceholderText('Motorizácia, napr. 2.0 TDI…')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^2\.0 TDI/ }))

    expect(onChange).toHaveBeenLastCalledWith({ make: 'Škoda', makeId: 1, model: 'Octavia III', modelId: 11, engine: '2.0 TDI', engineId: 111 })
    expect(screen.getByRole('button', { name: 'Zmeniť vozidlo' })).toBeInTheDocument()
  })

  it('accepts a make that is not in the catalogue', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('Hľadať značku…'), 'Lada')
    await userEvent.click(screen.getByRole('button', { name: 'Použiť „Lada“ ako novú značku' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_VEHICLE, make: 'Lada' })
  })

  it('offers the whole make and all engines on the norms form', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} optionalLevels />)
    await userEvent.click(screen.getByRole('button', { name: /^Škoda/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Celá značka Škoda' }))
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_VEHICLE, make: 'Škoda', makeId: 1 })
    expect(screen.getByTitle('Zmeniť model')).toHaveTextContent('celá značka')
  })

  it('opens at the engine step when a VIN already gave make and model', () => {
    render(<Harness initial={{ ...EMPTY_VEHICLE, make: 'Škoda', makeId: 1, model: 'Octavia III', modelId: 11 }} onChange={vi.fn()} startAt="engine" />)
    expect(screen.getByPlaceholderText('Motorizácia, napr. 2.0 TDI…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1.6 TDI' })).toBeInTheDocument()
  })

  it('finds a car from the history by plate when lookup is on', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} optionalLevels lookup />)
    const box = screen.getByPlaceholderText('Značka, ŠPZ alebo VIN…')
    await userEvent.type(box, 'ZA 412')
    const card = await screen.findByText('Škoda Octavia III 2.0 TDI · ZA 412 KL')
    // A plate must not be offered as a new make.
    expect(screen.queryByRole('button', { name: /ako novú značku/ })).not.toBeInTheDocument()
    await userEvent.click(within(card.closest('.lookup-card') as HTMLElement).getByRole('button', { name: 'Použiť' }))
    expect(onChange).toHaveBeenLastCalledWith({ make: 'Škoda', makeId: 1, model: 'Octavia III', modelId: 11, engine: '2.0 TDI', engineId: 111 })
    expect(screen.getByRole('button', { name: 'Zmeniť vozidlo' })).toBeInTheDocument()
  })
})
