import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('writes semicolons, decimal commas and quotes only where needed', () => {
    expect(toCsv([['Číslo', 'Zákazník', 'Zárobok €'], ['0007', 'Kubišta; s.r.o.', 120.5], ['0008', 'Ján "Jano"', 33], ['0009', null, 0]]))
      .toBe('﻿Číslo;Zákazník;Zárobok €\r\n0007;"Kubišta; s.r.o.";120,50\r\n0008;"Ján ""Jano""";33\r\n0009;;0\r\n')
  })
})
