/** One word of OCR output: text, confidence (0–100) and its box in image pixels. */
export interface OcrWord { text: string; conf: number; x0: number; y0: number; x1: number; y1: number }

/**
 * A part row read off a supplier's cart or order screenshot. Prices are what the row shows (the row total,
 * not per piece); `suggested` is false for rows that look like an order total, shipping or payment.
 */
export interface ScannedPart { name: string; code: string | null; qty: number | null; gross: number | null; net: number | null; suggested: boolean }

interface Seg { words: OcrWord[]; text: string; x0: number; x1: number; y0: number; y1: number; cy: number }
interface Price { seg: Seg; amount: number; net: boolean }

const PRICE = /^(?:€\s*)?(\d{1,3}(?:[ . ]\d{3})+|\d+)(?:[,.](\d{1,2}))?\s*(?:€|EUR\b)/i
/** Lines next to a price that are never the part's name: delivery, status, plate box, VAT labels. */
const NOT_NAME = /term[ií]n|dodani|doručen|skladom|dostupn|\bŠPZ\b|\bSPZ\b|\bDPH\b|množstv|vybavuj|objednávk|^stav\b|^spolu|celkom|zľava|košík/i
/** Rows a shop adds to an order that are not parts. */
const NOT_PART = /doprav|poštovn|balné|platb|dobierk|osobný odber|v hotovosti|kuriér|zásielkov/i

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}
const letters = (s: string): number => (s.match(/\p{L}/gu) ?? []).length
const height = (w: { y0: number; y1: number }) => w.y1 - w.y0

function seg(words: OcrWord[]): Seg {
  const y0 = Math.min(...words.map(w => w.y0))
  const y1 = Math.max(...words.map(w => w.y1))
  return { words, text: words.map(w => w.text).join(' '), x0: words[0].x0, x1: words[words.length - 1].x1, y0, y1, cy: (y0 + y1) / 2 }
}

/** Words that sit on one baseline with no more than a wide space between them form a run of text. */
function runs(words: OcrWord[]): OcrWord[][] {
  const out: OcrWord[][] = []
  for (const w of [...words].sort((a, b) => a.x0 - b.x0)) {
    let best: OcrWord[] | null = null
    let bestDy = Infinity
    for (const run of out) {
      const last = run[run.length - 1]
      const h = Math.max(height(w), height(last))
      const dy = Math.abs((w.y0 + w.y1) / 2 - (last.y0 + last.y1) / 2)
      const gap = w.x0 - last.x1
      if (dy <= h / 2 && gap > -h / 2 && gap < 1.5 * h && dy < bestDy) { best = run; bestDy = dy }
    }
    if (best) best.push(w)
    else out.push([w])
  }
  return out
}

/** Prices in a run; text before the first one ("Olej 5W-30 … 12,90 €") is split off as its own run. */
function pricesOf(words: OcrWord[]): { lead: OcrWord[] | null; prices: Price[] } {
  for (let k = 0; k < words.length; k++) {
    const rest = words.slice(k)
    if (!PRICE.test(rest.map(w => w.text).join(' '))) continue
    const s = seg(rest)
    const found = [...s.text.matchAll(new RegExp(PRICE.source.slice(1), 'gi'))]
    const prices = found.map((m, i): Price => {
      const at = m.index ?? 0
      const after = s.text.slice(at + m[0].length, found[i + 1]?.index ?? s.text.length)
      const whole = m[1].replace(/[ . ]/g, '')
      return { seg: s, amount: Number(`${whole}.${(m[2] ?? '0').padEnd(2, '0')}`), net: /^\W*bez/i.test(after) || /bez\s*DPH\W*$/i.test(s.text.slice(0, at)) }
    })
    const lead = k > 0 && letters(words.slice(0, k).map(w => w.text).join(' ')) >= 3 ? words.slice(0, k) : null
    return { lead, prices }
  }
  return { lead: null, prices: [] }
}

/** A part number: one token with a digit ("GDB3515", "24.0112-0150.1") or spaced digit groups ("0 986 494 104"). */
const CODE = /^(?:(?=[^ ]*\d)[A-Z0-9][A-Z0-9.\-/]{2,}[A-Z0-9]|\d{1,4}(?: \d{1,4}){1,4})$/
const DATE = /^\d{1,2}\.\s?\d{1,2}\.(\s?\d{2,4})?$/
const strip = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, '')

function qtyOf(segs: Seg[]): number | null {
  let weak: number | null = null
  for (const s of segs) {
    const t = strip(s.text)
    const m = t.match(/^(\d{1,3})\s*(?:x|×|ks\.?|pcs)$/i) ?? t.match(/^[x×]\s*(\d{1,3})$/i) ?? t.match(/mno[žz]stvo\s*:?\s*(\d{1,3})/i)
    if (m) return Number(m[1]) || null
    // A bare number counts only when OCR is sure of it (the quantity box of a cart).
    if (weak === null && /^\d{1,3}$/.test(t) && s.words.every(w => w.conf >= 70)) weak = Number(t) || null
  }
  return weak
}

/** "Čistič bŕzd 600 mi" → "Čistič bŕzd 600 ml": the usual OCR slips in part names, plus stray symbols at the ends. */
const cleanName = (s: string): string => strip(s).replace(/(\d)\s*mi\b/g, '$1 ml').replace(/\s+/g, ' ').trim()

/**
 * Parts in the OCR words of a supplier's cart or order page (Autosave, AutodielyPRO, …).
 * Every price stack (e.g. "41,28 € s DPH" over "33,56 € bez DPH") is one row; its name is the longest text
 * left of it on the same row, its code a separate part-number-like token there and its quantity "3x" / "2 ks".
 */
export function partsFromWords(input: OcrWord[]): ScannedPart[] {
  const usable = input.filter(w => w.text.trim() && w.conf >= 10)
  const H = median(usable.filter(w => w.conf >= 60).map(height)) || 16
  // Product thumbnails and icons come back as tall one-letter "words".
  const words = usable.filter(w => height(w) <= 3 * H)

  const segs: Seg[] = []
  const prices: Price[] = []
  for (const run of runs(words)) {
    const { lead, prices: found } = pricesOf(run)
    if (!found.length) { segs.push(seg(run)); continue }
    if (lead) segs.push(seg(lead))
    prices.push(...found)
  }

  // Prices stacked under each other in one column belong to one row.
  const stacks: Price[][] = []
  for (const p of [...prices].sort((a, b) => a.seg.y0 - b.seg.y0)) {
    const stack = stacks.find(st => {
      const last = st[st.length - 1].seg
      return last === p.seg || (p.seg.y0 - last.y1 < 1.2 * H && p.seg.x0 < last.x1 + H && p.seg.x1 > last.x0 - H)
    })
    if (stack) stack.push(p)
    else stacks.push([p])
  }

  const rows: ScannedPart[] = []
  for (const st of stacks) {
    const x0 = Math.min(...st.map(p => p.seg.x0))
    const top = Math.min(...st.map(p => p.seg.y0)) - 0.75 * H
    const bottom = Math.max(...st.map(p => p.seg.y1)) + 0.75 * H
    const near = segs.filter(s => s.cy >= top && s.cy <= bottom)
    const name = near
      .filter(s => s.x1 <= x0 + H && letters(s.text) >= 3 && !NOT_NAME.test(s.text) && !CODE.test(strip(s.text)))
      .sort((a, b) => letters(b.text) - letters(a.text) || a.x0 - b.x0)[0]
    if (!name) continue
    const rest = near.filter(s => s !== name && s.x0 >= name.x1)
    const code = rest.map(s => strip(s.text)).find(t => CODE.test(t) && !DATE.test(t)) ?? null
    // A crossed-out old price sits above the current one, so the last price of each kind wins.
    const gross = st.filter(p => !p.net).at(-1)?.amount ?? null
    const net = st.filter(p => p.net).at(-1)?.amount ?? null
    if (!gross && !net) continue
    const label = cleanName(name.text)
    rows.push({ name: label, code: code?.replace(/\s+/g, ' ') ?? null, qty: qtyOf(rest), gross, net, suggested: !NOT_PART.test(label) })
  }

  // An order header or total reads like a row too; it equals the sum of the rows with other amounts.
  const amount = (r: ScannedPart) => r.gross ?? r.net ?? 0
  for (const r of rows) {
    const others = rows.filter(o => Math.abs(amount(o) - amount(r)) >= 0.005)
    if (others.length >= 2 && Math.abs(others.reduce((a, o) => a + amount(o), 0) - amount(r)) < 0.015) r.suggested = false
  }
  return rows
}

/** "2 ks · GDB3515": the meta line of a part, as typed by hand in the part dialog. */
export const partMeta = (p: { qty: number | null; code: string | null }): string =>
  [p.qty ? `${p.qty} ks` : null, p.code].filter(Boolean).join(' · ')
