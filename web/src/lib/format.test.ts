import { describe, expect, it } from 'vitest'
import { addDays, eur, hm, hms, hoursSk, km, shortVin, skDate, skDateShort, weekday } from './format'

describe('format', () => {
  it('formats euro amounts the Slovak way', () => {
    expect(eur(0)).toBe('0,00 €')
    expect(eur(12.5)).toBe('12,50 €')
    expect(eur(1234567.891)).toBe('1 234 567,89 €')
  })

  it('formats durations', () => {
    expect(hm(0)).toBe('0 h 00 min')
    expect(hm(1500)).toBe('0 h 25 min')
    expect(hm(3 * 3600 + 12 * 60 + 59)).toBe('3 h 12 min')
    expect(hms(3661)).toBe('01:01:01')
    expect(hoursSk(1.25)).toBe('1,3 h')
  })

  it('formats dates from ISO strings without touching the timezone', () => {
    expect(skDate('2026-10-12T22:30:00.000Z')).toBe('12. 10. 2026')
    expect(skDateShort('2026-01-05')).toBe('5. 1.')
    expect(weekday('2026-10-12')).toBe('Pondelok')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('formats odometer and VIN', () => {
    expect(km(154320)).toBe('154 320 km')
    expect(km(999)).toBe('999 km')
    expect(shortVin('TMBJG7NE5J0114821')).toBe('TMBJG7NE…4821')
    expect(shortVin(null)).toBe('—')
  })
})
