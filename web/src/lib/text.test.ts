import { describe, expect, it } from 'vitest'
import { lowerFirst, plural } from './text'

describe('text', () => {
  it('picks the Slovak plural form', () => {
    const f = (n: number) => `${n} ${plural(n, 'zákazka', 'zákazky', 'zákaziek')}`
    expect(f(1)).toBe('1 zákazka')
    expect(f(2)).toBe('2 zákazky')
    expect(f(4)).toBe('4 zákazky')
    expect(f(5)).toBe('5 zákaziek')
    expect(f(0)).toBe('0 zákaziek')
  })

  it('lowercases only the first letter', () => {
    expect(lowerFirst('Brzdy vpredu')).toBe('brzdy vpredu')
    expect(lowerFirst('')).toBe('')
  })
})
