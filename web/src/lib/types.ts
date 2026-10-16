export type OrderStatus = 'new' | 'waiting' | 'open' | 'unpaid' | 'done'
export type PhotoStage = 'pred' | 'pocas' | 'po'
export type CodeStatus = 'open' | 'fixed' | 'watch'
export type Role = 'owner' | 'mechanic'
export type Period = 'week' | 'month' | 'year'

export interface User { id: number; name: string; email: string; role: Role; is_active: boolean }
export interface UserRef { id: number; name: string }

export interface Customer { id: number; name: string; phone: string | null; email: string | null }
export interface Car {
  id: number; make: string; model: string; engine: string | null
  car_model_id: number | null; car_engine_id: number | null; car_make_id: number | null; logo_url: string | null
  plate: string; vin: string | null; km: number
}

export interface CarEngine { id: number; car_model_id: number; name: string; cars_count: number }
/** `years` = production years of the generation, e.g. "2012–2019", orientation only. */
export interface CarModel { id: number; car_make_id: number; name: string; years: string | null; cars_count: number; engines: CarEngine[] }
export interface CarMake { id: number; name: string; logo_url: string | null; cars_count: number; models: CarModel[] }

/** Norm of a job for a make, one model of it, or one engine of that model. */
export interface OperationNorm {
  id: number; car_make_id: number; car_make: string | null; car_model_id: number | null; car_model: string | null
  car_engine_id: number | null; car_engine: string | null; norm_minutes: number
}

/** `price` is the retail price (MOC) on the invoice; `purchase_price` is what the shop paid (NC). */
export interface Part { id: number; name: string; meta: string | null; price: number; purchase_price: number | null; used: boolean; added_at: string }
/** Which part price the customer is billed on this order's report. */
export type PartsPricing = 'moc' | 'nc'
/** How labor is billed: measured time, or the norm hours of the order's jobs. */
export type LaborBilling = 'actual' | 'norm'

/** A catalogue job with its norm time and the shop's measured average. */
export interface Operation {
  id: number; name: string; category: string; norm_minutes: number; is_active: boolean; samples_count: number; avg_seconds: number | null
  norms: OperationNorm[]
  /** Present when the catalogue was asked for a specific car model. */
  car_norm_minutes?: number; car_norm_source?: 'engine' | 'model' | 'make' | 'default'; car_norm_id?: number | null; car_avg_seconds?: number | null; car_samples_count?: number
}
/** A job picked on an order (name and norm are snapshots). */
export interface OrderOperation { id: number; operation_id: number | null; name: string; norm_minutes: number; done: boolean }

/** One stint at the car. `ended_at === null` means the stopwatch is running. */
export interface WorkEntry {
  id: number
  user: UserRef
  started_at: string
  ended_at: string | null
  /** Seconds as of the server response; recompute for running entries. */
  seconds: number
  note: string | null
  manual: boolean
}

export interface Photo { id: number; url: string | null; label: string; stage: PhotoStage; taken_at: string }
export interface DiagCode { id: number; code: string; description: string | null; unit: string | null; status: CodeStatus }
export interface Diagnostic { id: number; file_name: string; file_url: string | null; pages: number; imported_at: string; codes: DiagCode[] }

export interface Totals {
  seconds: number; norm_seconds: number; delta_seconds: number | null
  labor: number; labor_actual: number; labor_norm: number; labor_billing: LaborBilling
  parts: number; parts_retail: number; parts_cost: number; parts_pricing: PartsPricing; grand_computed: number; grand: number
}

export interface Order {
  id: number
  number: string
  status: OrderStatus
  parts_pricing: PartsPricing
  /** Hand-edited total (zľava) and the calculated total it replaced; both null without an edit. */
  total_original: number | null
  total_override: number | null
  summary: string
  lift: string | null
  received_at: string | null
  closed_at: string | null
  public_token: string
  customer: Customer
  car: Car
  mechanic: UserRef | null
  parts: Part[]
  photos: Photo[]
  diagnostic: Diagnostic | null
  work_entries: WorkEntry[]
  operations: OrderOperation[]
  totals: Totals
}

export interface Business {
  name: string; owner: string; street: string; city: string; phone: string; email: string; iban: string; ico: string; vat_payer: boolean
}
export interface Settings { hourly_rate: number; labor_billing: LaborBilling; business: Business }

export interface DashboardData {
  period: Period
  label: string
  rate: number
  kpi: { parts: number; parts_retail: number; active_days: number; hours: number; labor: number; billed: number; margin: number | null; due: number; due_count: number; norm_hours: number; efficiency: number | null }
  bars: { label: string; labor: number; parts: number }[]
  mechanics: { id: number; name: string; hours: number }[]
  avg_hours_per_order: number
}

export interface NewOrderPayload {
  customer: { name: string; phone?: string; email?: string }
  /** `id` = a car from the history (found by ŠPZ/VIN): it is reused instead of creating a new one. */
  car: { id?: number; make: string; model: string; engine?: string; plate: string; vin?: string; km?: number }
  summary: string
  lift?: string
}

/** Result of `GET /vehicles/lookup?q=` – the shop's own history plus what the VIN itself reveals. */
export interface VehicleMatch {
  car: Car
  customer: Customer
  orders_count: number
  last_order: { id: number; number: string; received_at: string | null; summary: string } | null
}
export interface VinInfo {
  valid: boolean
  make: string | null; car_make_id: number | null; logo_url: string | null
  year: number | null
  /** Generation candidates; one when the code is unambiguous, several when it is shared. */
  models: { name: string; car_model_id: number | null; years: string | null }[]
}
export interface VehicleLookup { matches: VehicleMatch[]; vin: VinInfo | null }
