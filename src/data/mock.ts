import type { Job, Mechanic, Timer } from '../lib/types'
import { hhmm, isoDate } from '../lib/format'

export const DEFAULT_RATE = 28

export const mechanics: Mechanic[] = [
  { id: 'adam', name: 'Adam Belko' },
  { id: 'marek', name: 'Marek' },
  { id: 'tomas', name: 'Tomáš' },
]

/** Share of hours per mechanic used by the dashboard's period summaries. */
export const mechShare: Record<string, number> = { adam: 0.62, marek: 0.3, tomas: 0.08 }

export const firstName = (m?: Mechanic) => (m ? m.name.split(' ')[0] : '—')

export const emptyTimer = (): Timer => ({ running: false, base: 0, startedAt: 0, sessionStart: '', mechanicId: '', note: '' })

const runningFor = (sec: number, mechanicId: string, note: string): Timer => {
  const now = Date.now()
  return { running: true, base: sec, startedAt: now, sessionStart: hhmm(new Date(now - sec * 1000)), mechanicId, note }
}

export interface Period {
  label: string
  parts: number
  hours: number
  billed: number
  due: number
  dueN: number
  bars: [number, number][] // [labor %, parts %]
  days: string[]
}

export const periods: Period[] = [
  { label: 'Týždeň', parts: 1284.3, hours: 31.5, billed: 2310, due: 157.07, dueN: 1,
    bars: [[70, 40], [55, 30], [85, 60], [40, 20], [90, 75], [0, 0], [0, 0]], days: ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'] },
  { label: 'Mesiac', parts: 4860.5, hours: 128, billed: 9120, due: 1431.2, dueN: 4,
    bars: [[60, 45], [80, 70], [50, 30], [75, 55]], days: ['T40', 'T41', 'T42', 'T43'] },
  { label: 'Rok', parts: 41280, hours: 1410, billed: 94300, due: 2890, dueN: 7,
    bars: [[40, 30], [45, 35], [60, 40], [55, 50], [70, 45], [65, 60], [50, 35], [30, 20], [75, 55], [80, 70], [0, 0], [0, 0]],
    days: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] },
]

export function seedJobs(): Job[] {
  const today = isoDate(new Date())
  const twoDaysAgo = isoDate(new Date(Date.now() - 2 * 86400000))
  return [
    {
      id: '0231', date: today,
      customer: { name: 'Ján Kováč', phone: '+421 905 123 456' },
      car: { make: 'Škoda', model: 'Octavia III 2.0 TDI', plate: 'ZA 412 KL', vin: 'TMBJG7NE5J0114821', km: 184230 },
      summary: 'Brzdy vpredu + snímač EGR', lift: 'Zdvihák 1', receivedAt: '09:40',
      status: 'open', mechanicId: 'adam',
      parts: [
        { id: 'p1', name: 'Brzdové kotúče ATE 312 mm', meta: '2 ks · 24.0112-0150.1', price: 89.9, used: true, addedAt: '11:40' },
        { id: 'p2', name: 'Brzdové platničky Brembo P85 075', meta: '1 sada', price: 54.2, used: true, addedAt: '11:40' },
        { id: 'p3', name: 'Snímač EGR Pierburg 7.22818.56', meta: '1 ks', price: 112, used: true, addedAt: '11:40' },
        { id: 'p4', name: 'Brzdová kvapalina DOT4', meta: '0,5 l · neúčtované', price: 9.8, used: false, addedAt: '11:40' },
      ],
      photos: [
        { id: 'f0', label: 'Auto zákazníka', stage: 'pred', takenAt: '09:40' },
        { id: 'f1', label: 'Kotúč pred', stage: 'pred', takenAt: '09:50' },
        { id: 'f2', label: 'EGR ventil', stage: 'pred', takenAt: '09:50' },
        { id: 'f3', label: 'Kotúč po', stage: 'po', takenAt: '12:30' },
        { id: 'f4', label: 'Nový snímač', stage: 'po', takenAt: '13:55' },
      ],
      diagnostic: {
        file: 'VCDS_octavia_0231.pdf', pages: 6, importedAt: '09:42',
        codes: [
          { code: 'P0401', desc: 'Nedostatočný prietok recirkulácie výfukových plynov (EGR)', unit: 'Motor · 01', status: 'fixed' },
          { code: 'P2002', desc: 'Účinnosť filtra pevných častíc pod prahom', unit: 'Motor · 01', status: 'watch' },
        ],
      },
      work: [
        { id: 'w1', mechanicId: 'adam', start: '10:05', seconds: 5400, note: 'Demontáž a výmena brzdových kotúčov a platničiek vpredu' },
        { id: 'w2', mechanicId: 'marek', start: '13:10', seconds: 3000, note: 'Výmena snímača EGR, adaptácia riadiacej jednotky' },
      ],
      timer: runningFor(1860, 'adam', 'Diagnostika, skúšobná jazda, kontrola brzdného účinku'),
    },
    {
      id: '0232', date: today,
      customer: { name: 'Eva Hrušková', phone: '+421 911 222 333' },
      car: { make: 'VW', model: 'Passat B8 1.6 TDI', plate: 'ZA 908 FT', vin: 'WVWZZZ3CZJE051234', km: 142870 },
      summary: 'Servisná prehliadka, olej + filtre', lift: 'Zdvihák 2', receivedAt: '12:30',
      status: 'open', mechanicId: 'marek',
      parts: [
        { id: 'p1', name: 'Motorový olej Castrol Edge 5W-30 LL', meta: '5 l', price: 48.9, used: true, addedAt: '12:50' },
        { id: 'p2', name: 'Olejový filter Mann HU 7020 z', meta: '1 ks', price: 12.4, used: true, addedAt: '12:50' },
        { id: 'p3', name: 'Vzduchový filter Mann C 27 009', meta: '1 ks', price: 18.3, used: true, addedAt: '12:50' },
        { id: 'p4', name: 'Kabínový filter Mann CUK 26 010', meta: '1 ks', price: 21, used: true, addedAt: '12:50' },
        { id: 'p5', name: 'Palivový filter Mann PU 8028', meta: '1 ks', price: 42, used: true, addedAt: '12:50' },
      ],
      photos: [{ id: 'f0', label: 'Auto zákazníka', stage: 'pred', takenAt: '12:32' }],
      work: [],
      timer: runningFor(48 * 60 + 12, 'marek', 'Výmena oleja a filtrov, kontrola podvozku'),
    },
    {
      id: '0233', date: today,
      customer: { name: 'Peter Lacko', phone: '+421 902 555 777' },
      car: { make: 'BMW', model: '320d F30', plate: 'ZA 115 DK', vin: 'WBA3D31050F123456', km: 211400 },
      summary: 'Spojka', receivedAt: '14:00',
      status: 'waiting',
      parts: [{ id: 'p1', name: 'Spojková sada LuK 624 3277 00', meta: '1 sada · objednané', price: 389, used: true, addedAt: '08:15' }],
      photos: [],
      work: [],
      timer: emptyTimer(),
    },
    {
      id: '0229', date: twoDaysAgo,
      customer: { name: 'Mária Vargová', phone: '+421 948 101 202' },
      car: { make: 'Kia', model: 'Ceed 1.4 CRDi', plate: 'ZA 331 PE', vin: 'U5YHN516AEL123456', km: 96350 },
      summary: 'Olej, brzdová kvapalina, stierače', receivedAt: '08:30',
      status: 'unpaid', mechanicId: 'tomas',
      parts: [
        { id: 'p1', name: 'Motorový olej Shell Helix 5W-30', meta: '4 l', price: 41.9, used: true, addedAt: '09:10' },
        { id: 'p2', name: 'Olejový filter Bosch F 026 407 072', meta: '1 ks', price: 14.5, used: true, addedAt: '09:10' },
        { id: 'p3', name: 'Brzdová kvapalina DOT4', meta: '1 l', price: 15, used: true, addedAt: '09:10' },
        { id: 'p4', name: 'Stierače Bosch Aerotwin A 414 S', meta: '1 sada', price: 25, used: true, addedAt: '09:10' },
      ],
      photos: [{ id: 'f0', label: 'Auto zákazníka', stage: 'pred', takenAt: '08:32' }],
      work: [
        { id: 'w1', mechanicId: 'tomas', start: '08:45', seconds: 5400, note: 'Výmena oleja a filtra, výmena brzdovej kvapaliny' },
        { id: 'w2', mechanicId: 'tomas', start: '10:30', seconds: 2400, note: 'Výmena stieračov, kontrola osvetlenia, skúšobná jazda' },
      ],
      timer: emptyTimer(),
    },
  ]
}
