export type OrderStatus = 'new' | 'waiting' | 'open' | 'unpaid' | 'done'
export type PhotoStage = 'pred' | 'pocas' | 'po'
export type CodeStatus = 'open' | 'fixed' | 'watch'
export type Role = 'owner' | 'mechanic'
export type Period = 'week' | 'month' | 'year'

export interface User { id: number; name: string; email: string; role: Role; is_active: boolean }
export interface UserRef { id: number; name: string }

export interface Customer { id: number; name: string; phone: string | null; email: string | null }
export interface Car { id: number; make: string; model: string; plate: string; vin: string | null; km: number }

/** `price` is the retail price (MOC) on the invoice; `purchase_price` is what the shop paid (NC). */
export interface Part { id: number; name: string; meta: string | null; price: number; purchase_price: number | null; used: boolean; added_at: string }
/** Which part price the customer is billed on this order's report. */
export type PartsPricing = 'moc' | 'nc'
/** How labor is billed: measured time, or the norm hours of the order's jobs. */
export type LaborBilling = 'actual' | 'norm'

/** A catalogue job with its norm time and the shop's measured average. */
export interface Operation { id: number; name: string; category: string; norm_minutes: number; is_active: boolean; samples_count: number; avg_seconds: number | null }
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
  parts: number; parts_retail: number; parts_cost: number; parts_pricing: PartsPricing; grand: number
}

export interface Order {
  id: number
  number: string
  status: OrderStatus
  parts_pricing: PartsPricing
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
  car: { make: string; model: string; plate: string; vin?: string; km?: number }
  summary: string
  lift?: string
}
