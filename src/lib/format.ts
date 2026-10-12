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

export const skDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}. ${m}. ${y}`
}

export const skDateShort = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${d}. ${m}.`
}

const WEEKDAYS = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota']
export const weekday = (iso: string) => WEEKDAYS[new Date(iso + 'T12:00:00').getDay()]

const MONTHS = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December']
export const monthTitle = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`

export const km = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' km'

export const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export const shortVin = (vin: string) => (vin.length > 12 ? `${vin.slice(0, 8)}…${vin.slice(-4)}` : vin || '—')

export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
export const fromMin = (n: number) =>
  `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

/** ISO week number and its Monday–Sunday span, e.g. "Týždeň 42 · 12.–18. 10. 2026". */
export const weekTitle = (d: Date) => {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (day.getDay() + 6) % 7 // Monday = 0
  const monday = new Date(day)
  monday.setDate(day.getDate() - dow)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const thu = new Date(monday)
  thu.setDate(monday.getDate() + 3)
  const jan1 = new Date(thu.getFullYear(), 0, 1)
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  const span = monday.getMonth() === sunday.getMonth()
    ? `${monday.getDate()}.–${sunday.getDate()}. ${sunday.getMonth() + 1}. ${sunday.getFullYear()}`
    : `${monday.getDate()}. ${monday.getMonth() + 1}. – ${sunday.getDate()}. ${sunday.getMonth() + 1}. ${sunday.getFullYear()}`
  return `Týždeň ${week} · ${span}`
}
