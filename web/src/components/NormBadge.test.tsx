import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NormBadge from './NormBadge'

describe('NormBadge', () => {
  it('is green with the saved money while under the norm', () => {
    render(<NormBadge seconds={3600} normSeconds={5100} rate={28} />)
    const badge = screen.getByText(/0 h 25 min/)
    expect(badge).toHaveClass('norm-ok')
    expect(badge).toHaveTextContent('+0 h 25 min · +11,67 €')
  })

  it('is red with the lost money once over the norm', () => {
    render(<NormBadge seconds={7200} normSeconds={3600} rate={30} />)
    const badge = screen.getByText(/1 h 00 min/)
    expect(badge).toHaveClass('norm-bad')
    expect(badge).toHaveTextContent('−1 h 00 min · −30,00 €')
  })

  it('renders nothing without a norm', () => {
    const { container } = render(<NormBadge seconds={100} normSeconds={0} rate={28} />)
    expect(container).toBeEmptyDOMElement()
  })
})
