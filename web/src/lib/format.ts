export const eur = (n: number) =>
  n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'

export const hm = (sec: number) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h} h ${String(m).padStart(2, '0')} min`
}

export const hms = (sec: number) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(sec / 3600))}:${p(Math.floor((sec % 3600) / 60))}:${p(sec % 60)}`
}

export const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Local wall-clock time of an ISO timestamp from the API. */
export const timeOf = (iso: string) => hhmm(new Date(iso))
/** Local calendar day (YYYY-MM-DD) of an ISO timestamp from the API. */
export const dateOf = (iso: string) => isoDate(new Date(iso))

export const skDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d}. ${m}. ${y}`
}

export const skDateShort = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d}. ${m}.`
}

const WEEKDAYS = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota']
export const WEEKDAYS_SHORT = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So']
export const weekday = (iso: string) => WEEKDAYS[new Date(iso.slice(0, 10) + 'T12:00:00').getDay()]

/** A planned time relative to today: "dnes 10:00", "zajtra 08:00", "Št 13:00" within the week, else "21. 10. 08:00". */
export const planLabel = (iso: string, now: number): string => {
  const d = new Date(iso)
  const day = isoDate(d)
  const today = isoDate(new Date(now))
  const diff = Math.round((Date.parse(day + 'T12:00:00') - Date.parse(today + 'T12:00:00')) / 86_400_000)
  const when = diff === 0 ? 'dnes' : diff === 1 ? 'zajtra' : diff === -1 ? 'včera' : diff > 1 && diff < 7 ? WEEKDAYS_SHORT[d.getDay()] : skDateShort(day)
  return `${when} ${hhmm(d)}`
}

/** Monday (YYYY-MM-DD) of the week containing the given day. */
export const mondayOf = (iso: string): string => {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoDate(d)
}

/** ISO week number (1–53) of a day. */
export const isoWeek = (iso: string): number => {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
}

/** Local date + time inputs → ISO for the API; an empty date means no plan. */
export const localToIso = (date: string, time: string): string | null => (date ? new Date(`${date}T${time || '08:00'}:00`).toISOString() : null)

export const km = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km'

export const addDays = (iso: string, days: number) => {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export const shortVin = (vin: string | null) => (vin && vin.length > 12 ? `${vin.slice(0, 8)}…${vin.slice(-4)}` : vin || '—')

/** Hours with one decimal and a Slovak decimal comma: 3,7 h */
export const hoursSk = (n: number) => n.toFixed(1).replace('.', ',') + ' h'
