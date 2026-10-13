import type { CarMake, VehicleLookup, VehicleMatch, VinInfo } from '../lib/types'

/** Two makes with models/engines, Škoda worked on more often than VW. */
export const MAKES: CarMake[] = [
  {
    id: 1, name: 'Škoda', logo_url: null, cars_count: 3, models: [
      { id: 11, car_make_id: 1, name: 'Octavia III', years: '2012–2020', cars_count: 2, engines: [{ id: 111, car_model_id: 11, name: '2.0 TDI', cars_count: 2 }, { id: 112, car_model_id: 11, name: '1.6 TDI', cars_count: 0 }] },
      { id: 12, car_make_id: 1, name: 'Fabia III', years: '2014–2021', cars_count: 1, engines: [{ id: 121, car_model_id: 12, name: '1.0 TSI', cars_count: 0 }] },
    ],
  },
  {
    id: 2, name: 'Volkswagen', logo_url: null, cars_count: 1, models: [
      { id: 21, car_make_id: 2, name: 'Passat B7', years: '2010–2014', cars_count: 0, engines: [{ id: 211, car_model_id: 21, name: '2.0 TDI', cars_count: 0 }] },
    ],
  },
]

export const MATCH: VehicleMatch = {
  car: { id: 7, make: 'Škoda', model: 'Octavia III', engine: '2.0 TDI', car_make_id: 1, car_model_id: 11, car_engine_id: 111, logo_url: null, plate: 'ZA 412 KL', vin: 'TMBJG7NE5J0114821', km: 154320 },
  customer: { id: 3, name: 'Ján Kováč', phone: '+421 905 123 456', email: null },
  orders_count: 3,
  last_order: { id: 1, number: '0231', received_at: '2026-10-12T08:00:00.000Z', summary: 'Brzdy vpredu' },
}

export const VIN_OCTAVIA: VinInfo = {
  valid: true, make: 'Škoda', car_make_id: 1, logo_url: null, year: 2018,
  models: [{ name: 'Octavia III', car_model_id: 11, years: '2012–2020' }],
}

export const VIN_SHARED: VinInfo = {
  valid: true, make: 'Škoda', car_make_id: 1, logo_url: null, year: 2020,
  models: [{ name: 'Scala', car_model_id: null, years: '2019–' }, { name: 'Kamiq', car_model_id: null, years: '2019–' }],
}

/** What the API would answer for a query: history hits for "ZA 412", VIN decode for the Octavia VIN. */
export function lookupFor(q: string): VehicleLookup | undefined {
  const key = q.replace(/[\s-]+/g, '').toUpperCase()
  if (key.length < 3) return undefined
  if (key === 'TMBJG7NE5J0114821') return { matches: [MATCH], vin: VIN_OCTAVIA }
  if (key === 'TMBZZZNWZL1234567') return { matches: [], vin: VIN_SHARED }
  if ('ZA412KL'.startsWith(key)) return { matches: [MATCH], vin: null }
  return { matches: [], vin: key.length === 17 ? { valid: true, make: null, car_make_id: null, logo_url: null, year: null, models: [] } : null }
}
