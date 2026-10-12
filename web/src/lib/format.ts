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
export const weekday = (iso: string) => WEEKDAYS[new Date(iso.slice(0, 10) + 'T12:00:00').getDay()]

export const km = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km'

export const addDays = (iso: string, days: number) => {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export const shortVin = (vin: string | null) => (vin && vin.length > 12 ? `${vin.slice(0, 8)}…${vin.slice(-4)}` : vin || '—')

/** Hours with one decimal and a Slovak decimal comma: 3,7 h */
export const hoursSk = (n: number) => n.toFixed(1).replace('.', ',') + ' h'
