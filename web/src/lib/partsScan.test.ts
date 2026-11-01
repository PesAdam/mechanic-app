import { describe, expect, it } from 'vitest'
import { partMeta, partsFromWords, type OcrWord } from './partsScan'
// Real Tesseract output (slk, sparse text) of two supplier screenshots, header bar and e-mail stripped.
import autosave from './ocr-fixtures/autosave.json'
import autodielypro from './ocr-fixtures/autodielypro.json'

const fixture = (rows: unknown[]): OcrWord[] =>
  (rows as [string, number, number, number, number, number][]).map(([text, conf, x0, y0, x1, y1]) => ({ text, conf, x0, y0, x1, y1 }))

/** One line of text as OCR words, starting at x and centred on y. */
const line = (text: string, x: number, y: number): OcrWord[] => {
  let at = x
  return text.split(' ').map(t => {
    const w = { text: t, conf: 95, x0: at, y0: y - 8, x1: at + t.length * 9, y1: y + 8 }
    at = w.x1 + 6
    return w
  })
}

describe('partsFromWords', () => {
  it('reads an Autosave cart: name, part number and both VAT prices of every row', () => {
    expect(partsFromWords(fixture(autosave))).toEqual([
      { name: 'Sada brzdových platničiek kotúčovej brzdy', code: 'GDB3515', qty: null, gross: 41.28, net: 33.56, suggested: true },
      { name: 'Sada brzdových platničiek kotúčovej brzdy', code: 'GDB3505', qty: null, gross: 37.87, net: 30.79, suggested: true },
      { name: 'Brzdová kvapalina TRW DOT4 1L', code: 'PFB401', qty: null, gross: 15.77, net: 12.82, suggested: true },
    ])
  })

  it('reads an AutodielyPRO order: quantities, the discounted price, no 0 € pickup/payment rows or order total', () => {
    expect(partsFromWords(fixture(autodielypro))).toEqual([
      { name: 'Hydraulický olej CASTROL 15F224', code: null, qty: 3, gross: 55.8, net: null, suggested: true },
      { name: 'CASTROL EDGE TITANIUM FST 5W-40 1L', code: null, qty: 6, gross: 67.8, net: null, suggested: true },
      { name: 'Čistič brzd WINKLER 600 ml - 490 003 902 01', code: null, qty: 2, gross: 6, net: null, suggested: true },
    ])
  })

  it('splits a name printed on the same line as its price and leaves shipping and the total unticked', () => {
    const words = [
      ...line('Olejový filter MANN W 712/95', 100, 100), ...line('0 986 494 104', 600, 100), ...line('2 ks', 800, 100), ...line('8,90 €', 1000, 100),
      ...line('Vzduchový filter 12,50 €', 100, 200),
      ...line('Doprava kuriérom', 100, 300), ...line('3,90 €', 1000, 300),
      ...line('Suma', 100, 400), ...line('25,30 €', 1000, 400),
    ]
    expect(partsFromWords(words)).toEqual([
      { name: 'Olejový filter MANN W 712/95', code: '0 986 494 104', qty: 2, gross: 8.9, net: null, suggested: true },
      { name: 'Vzduchový filter', code: null, qty: null, gross: 12.5, net: null, suggested: true },
      { name: 'Doprava kuriérom', code: null, qty: null, gross: 3.9, net: null, suggested: false },
      { name: 'Suma', code: null, qty: null, gross: 25.3, net: null, suggested: false },
    ])
  })

  it('finds nothing on a page without prices', () => {
    expect(partsFromWords(line('Rýchle pridanie položiek', 100, 100))).toEqual([])
  })
})

describe('partMeta', () => {
  it('joins the quantity and the part number like the part dialog', () => {
    expect(partMeta({ qty: 2, code: 'GDB3515' })).toBe('2 ks · GDB3515')
    expect(partMeta({ qty: null, code: 'PFB401' })).toBe('PFB401')
    expect(partMeta({ qty: 3, code: null })).toBe('3 ks')
  })
})
