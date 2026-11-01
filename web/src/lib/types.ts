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
  car_norm_minutes?: number; car_norm_source?: 'engine' | 'model' | 'make' | 'vehicle' | 'default'; car_norm_id?: number | null; car_avg_seconds?: number | null; car_samples_count?: number
}
/** A job picked on an order (name and norm are snapshots). `seconds` = time clocked against it as of the server response. */
export interface OrderOperation {
  id: number; operation_id: number | null; name: string; norm_minutes: number; done: boolean; seconds: number
  /** What the customer is billed for this job: its share of the measured time (forgotten time goes to jobs without their own) and the € for it. */
  billed_seconds: number; amount: number
}

/** One stint at the car. `ended_at === null` means the stopwatch is running. */
export interface WorkEntry {
  id: number
  user: UserRef
  /** The job this stint was clocked against; null = the plain order-level stopwatch. */
  order_operation_id: number | null
  started_at: string
  ended_at: string | null
  /** Seconds as of the server response; recompute for running entries. */
  seconds: number
  note: string | null
  manual: boolean
  /** Closed by the system after nobody paused it for 10 h: the owner should check the time. */
  auto_closed: boolean
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
  /** When the shop plans to work on the order (ISO) and for how long; null = unplanned / the norm sum. */
  planned_at: string | null
  planned_minutes: number | null
  closed_at: string | null
  /** When it was marked Uhradená; zárobok counts on this day. */
  paid_at: string | null
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
  /** What the customer's report prints for labour, built on the server (rows follow the report_labor setting). */
  report: CustomerReport
}

export interface CustomerReport {
  rows: { label: string; seconds: number | null; amount: number | null }[]
  /** First to last record of the order, for the "09:40 – 15:05" line. */
  period: { from: string; to: string } | null
}

export interface Business {
  name: string; owner: string; street: string; city: string; phone: string; email: string; iban: string; ico: string; vat_payer: boolean
}
/** How the customer report prints labour: a price per job (default), time with the hourly rate, or only the total. */
export type ReportLabor = 'price' | 'time' | 'total'
export interface Settings { hourly_rate: number; labor_billing: LaborBilling; report_labor: ReportLabor; business: Business }
/** What the public report page receives: the rate only when the owner prints it. */
export interface ReportSettings { hourly_rate: number | null; labor_billing: LaborBilling; report_labor: ReportLabor; business: Business }

export interface DashboardData {
  period: Period
  label: string
  rate: number
  /**
   * Zárobok (earnings … orders, paid) is of the orders paid in the period; `pending` of the ones closed in it and not paid yet;
   * `billed*` of all orders closed in it. `hours` is the time clocked in the period.
   */
  kpi: {
    earnings: number; labor: number; parts_cost: number; parts_margin: number; discount: number; orders: number; pending: Pending
    billed: number; billed_parts_cost: number; billed_orders: number
    hours: number; paid: number; paid_count: number; due: number; due_count: number; norm_hours: number; efficiency: number | null
  }
  /** By the day orders were paid: zárobok and what their parts cost. */
  bars: { label: string; earnings: number; parts: number }[]
  mechanics: { id: number; name: string; hours: number }[]
  avg_hours_per_order: number
}

/** Money of the orders paid in a period. Zárobok = billed − parts at purchase price = labor + parts margin − zľavy. */
export interface Earnings {
  orders: number; billed: number; labor: number; parts_billed: number; parts_cost: number; parts_margin: number; discount: number
  earnings: number; hours: number; per_hour: number | null
}

/** Zárobok of orders closed but not paid yet ("čaká na platbu"): it counts once the money comes in. */
export type Pending = Pick<Earnings, 'orders' | 'labor' | 'parts_margin' | 'earnings'>

export interface EarningsLine {
  id: number; number: string; closed_at: string | null; paid_at: string | null; status: OrderStatus; car: string; plate: string | null; customer: string | null
  hours: number; labor: number; parts_billed: number; parts_cost: number; discount: number; billed: number; earnings: number
}

/** `GET /stats`: one week, month or year next to the one before and the same one a year earlier. */
export interface StatsData {
  period: Period
  label: string
  start: string
  end: string
  previous_date: string
  /** null when the period is the current one (nothing to page forward to). */
  next_date: string | null
  current: Earnings
  pending: Earnings
  previous: Earnings & { label: string }
  year_earlier: (Earnings & { label: string }) | null
  trend: (Earnings & { label: string; title: string; date: string })[]
  orders: EarningsLine[]
}

export interface NewOrderPayload {
  customer: { name: string; phone?: string; email?: string }
  /** `id` = a car from the history (found by ŠPZ/VIN): it is reused instead of creating a new one. */
  car: { id?: number; make: string; model: string; engine?: string; plate: string; vin?: string; km?: number }
  summary: string
  lift?: string
  planned_at?: string
  planned_minutes?: number
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

/** How a client reaches the shop; the portal gets nothing else from the settings. */
export interface Shop { name: string; phone: string; email: string; street: string; city: string }

/** Portal: a signed-in invited client. */
export interface PortalClient { id: number; name: string; email: string; phone: string; shop: Shop }

/** Portal: how far a request got, as its sender sees it. */
export type RequestPhase = 'sent' | 'accepted' | 'in_progress' | 'done' | 'rejected'

interface RequestCar { plate: string; make: string; model: string; engine: string | null; vin: string | null; km: number | null }

/** Portal: one of the client's own requests. Of the shop's order only the number, the planned day and the report link. */
export interface PortalRequest extends RequestCar {
  id: number; description: string; preferred_date: string | null; photos: string[]; created_at: string
  phase: RequestPhase; reject_reason: string | null
  order: { number: string; planned_at: string | null; report_token: string | null } | null
}

export type RequestStatus = 'new' | 'accepted' | 'rejected'

/** Požiadavky: what an invited client sent, as the shop sees it. */
export interface ServiceRequest extends RequestCar {
  id: number; client: { id: number; name: string; phone: string; email: string }
  description: string; preferred_date: string | null; photos: string[]
  status: RequestStatus; reject_reason: string | null; created_at: string; handled_at: string | null
  order: { id: number; number: string; status: OrderStatus } | null
}

export interface ClientInvite {
  id: number; note: string | null; state: 'open' | 'used' | 'revoked' | 'expired'; expires_at: string; created_at: string
  client: { id: number; name: string } | null
}

/** Someone registered through an invite. */
export interface PortalAccount { id: number; name: string; email: string; phone: string; is_active: boolean; requests_count: number; created_at: string }
