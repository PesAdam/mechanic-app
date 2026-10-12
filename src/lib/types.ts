export type JobStatus = 'new' | 'waiting' | 'open' | 'unpaid' | 'done'
export type PhotoStage = 'pred' | 'pocas' | 'po'
export type CodeStatus = 'open' | 'fixed' | 'watch'

export interface Mechanic { id: string; name: string }

export interface Part {
  id: string
  name: string
  meta: string
  price: number
  used: boolean
  addedAt: string // HH:MM
}

export interface WorkEntry {
  id: string
  mechanicId: string
  start: string // HH:MM
  seconds: number
  note: string
  manual?: boolean
}

export interface Photo {
  id: string
  label: string
  stage: PhotoStage
  takenAt: string // HH:MM
  src?: string // data URL once the mechanic fills the slot
}

export interface DiagCode { code: string; desc: string; unit: string; status: CodeStatus }

export interface Diagnostic {
  file: string
  pages: number
  importedAt: string // HH:MM
  codes: DiagCode[]
}

/** The running stopwatch of one job: the current session only. Finished
 *  sessions live in `work` as entries with an author. */
export interface Timer {
  running: boolean
  base: number // seconds accumulated in this session before `startedAt`
  startedAt: number // epoch ms of the last start
  sessionStart: string // HH:MM the session began
  mechanicId: string
  note: string
}

export interface Customer { name: string; phone: string }
export interface Car { make: string; model: string; plate: string; vin: string; km: number }

export interface Job {
  id: string
  date: string // YYYY-MM-DD
  customer: Customer
  car: Car
  summary: string
  lift?: string
  receivedAt?: string // HH:MM
  status: JobStatus
  mechanicId?: string
  parts: Part[]
  photos: Photo[]
  diagnostic?: Diagnostic
  work: WorkEntry[]
  timer: Timer
}
