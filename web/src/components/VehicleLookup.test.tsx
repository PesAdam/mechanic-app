import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import VehicleLookupResults from './VehicleLookup'
import { EMPTY_VEHICLE } from './VehiclePicker'
import { lookupFor, MATCH, VIN_OCTAVIA, VIN_SHARED } from '../test/fixtures'

vi.mock('../data/queries', () => ({
  useVehicleLookup: (q: string) => ({ data: lookupFor(q) }),
}))

const setup = (q: string, picked = EMPTY_VEHICLE) => {
  const onMatch = vi.fn()
  const onVin = vi.fn()
  const view = render(<VehicleLookupResults q={q} picked={picked} onMatch={onMatch} onVin={onVin} />)
  return { onMatch, onVin, view }
}

describe('VehicleLookupResults', () => {
  it('shows nothing for fewer than three characters', async () => {
    const { view } = setup('ZA')
    await new Promise(r => setTimeout(r, 400))
    expect(view.container).toBeEmptyDOMElement()
  })

  it('offers a car from the history with its customer and last visit', async () => {
    const { onMatch } = setup('za 412')
    expect(await screen.findByText('Škoda Octavia III 2.0 TDI · ZA 412 KL')).toBeInTheDocument()
    expect(screen.getByText(/Ján Kováč · \+421 905 123 456 · 3 zákazky, naposledy 12\. 10\./)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Použiť' }))
    expect(onMatch).toHaveBeenCalledWith(MATCH)
  })

  it('decodes make, generation and model year from a VIN', async () => {
    const { onVin } = setup('TMBJG7NE5J0114821')
    expect(await screen.findByText('VIN: Škoda Octavia III · r. v. 2018')).toBeInTheDocument()
    expect(screen.getByText(/Generácia 2012–2020\. Orientačne, skontrolujte\./)).toBeInTheDocument()
    // The history hit is listed first, then the VIN hint; both have their own button.
    const buttons = screen.getAllByRole('button', { name: 'Použiť' })
    expect(buttons).toHaveLength(2)
    await userEvent.click(buttons[1])
    expect(onVin).toHaveBeenCalledWith(VIN_OCTAVIA, VIN_OCTAVIA.models[0])
  })

  it('lets the mechanic pick between generations that share a VIN code', async () => {
    const { onVin } = setup('TMBZZZNWZL1234567')
    expect(await screen.findByText('VIN: Škoda · r. v. 2020')).toBeInTheDocument()
    expect(screen.getByText(/Kód modelu zdieľa viac typov/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Kamiq (2019–)' }))
    expect(onVin).toHaveBeenCalledWith(VIN_SHARED, VIN_SHARED.models[1])
  })

  it('hides the button once the decoded vehicle is already picked', async () => {
    setup('TMBJG7NE5J0114821', { ...EMPTY_VEHICLE, make: 'Škoda', makeId: 1, model: 'Octavia III', modelId: 11 })
    await screen.findByText('VIN: Škoda Octavia III · r. v. 2018')
    expect(screen.getAllByRole('button', { name: 'Použiť' })).toHaveLength(1)
  })

  it('says so when the manufacturer is unknown', async () => {
    setup('ABC12345678901234')
    expect(await screen.findByText(/výrobcu sa nepodarilo rozpoznať/)).toBeInTheDocument()
  })
})
