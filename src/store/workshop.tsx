import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react'
import type { DiagCode, Job, Mechanic, Part, Photo } from '../lib/types'
import { DEFAULT_RATE, mechanics as seedMechanics, seedJobs } from '../data/mock'
import { hhmm } from '../lib/format'
import { uid } from '../lib/text'

export interface WorkshopState {
  version: 1
  jobs: Job[]
  mechanics: Mechanic[]
  hourlyRate: number
  currentMechanicId: string
}

export type Action =
  | { type: 'toggleTimer'; jobId: string }
  | { type: 'addManual'; jobId: string; minutes: number; note: string; mechanicId: string }
  | { type: 'togglePart'; jobId: string; partId: string }
  | { type: 'addPart'; jobId: string; part: Pick<Part, 'name' | 'meta' | 'price'> }
  | { type: 'addPhoto'; jobId: string; photo: Pick<Photo, 'label' | 'stage' | 'src'> }
  | { type: 'setPhoto'; jobId: string; photoId: string; src: string }
  | { type: 'setDiagnostic'; jobId: string; file: string }
  | { type: 'addCode'; jobId: string; code: DiagCode }
  | { type: 'closeJob'; jobId: string }
  | { type: 'addJob'; job: Job }
  | { type: 'setRate'; rate: number }
  | { type: 'reset' }

const STORAGE_KEY = 'mechanic-app:v1'

const initial = (): WorkshopState => ({
  version: 1, jobs: seedJobs(), mechanics: seedMechanics, hourlyRate: DEFAULT_RATE, currentMechanicId: 'adam',
})

function load(): WorkshopState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as WorkshopState
      if (s && s.version === 1 && Array.isArray(s.jobs)) return s
    }
  } catch { /* storage unavailable or corrupt: fall through to seed */ }
  return initial()
}

const now = () => Date.now()

function reducer(s: WorkshopState, a: Action): WorkshopState {
  const upd = (id: string, f: (j: Job) => Job): WorkshopState => ({ ...s, jobs: s.jobs.map(j => (j.id === id ? f(j) : j)) })
  switch (a.type) {
    case 'toggleTimer':
      return upd(a.jobId, j => {
        const t = j.timer
        if (t.running) {
          return { ...j, timer: { ...t, running: false, base: t.base + Math.floor((now() - t.startedAt) / 1000) } }
        }
        const mechanicId = t.mechanicId || j.mechanicId || s.currentMechanicId
        return {
          ...j,
          status: j.status === 'new' || j.status === 'waiting' ? 'open' : j.status,
          mechanicId: j.mechanicId ?? mechanicId,
          timer: { ...t, running: true, startedAt: now(), mechanicId, sessionStart: t.base > 0 && t.sessionStart ? t.sessionStart : hhmm(new Date()) },
        }
      })
    case 'addManual':
      return upd(a.jobId, j => ({
        ...j,
        status: j.status === 'new' || j.status === 'waiting' ? 'open' : j.status,
        mechanicId: j.mechanicId ?? a.mechanicId,
        work: [...j.work, { id: uid(), mechanicId: a.mechanicId, start: hhmm(new Date()), seconds: Math.round(a.minutes * 60), note: a.note, manual: true }],
      }))
    case 'togglePart':
      return upd(a.jobId, j => ({ ...j, parts: j.parts.map(p => (p.id === a.partId ? { ...p, used: !p.used } : p)) }))
    case 'addPart':
      return upd(a.jobId, j => ({ ...j, parts: [...j.parts, { id: uid(), used: true, addedAt: hhmm(new Date()), ...a.part }] }))
    case 'addPhoto':
      return upd(a.jobId, j => ({ ...j, photos: [...j.photos, { id: uid(), takenAt: hhmm(new Date()), ...a.photo }] }))
    case 'setPhoto':
      return upd(a.jobId, j => ({ ...j, photos: j.photos.map(p => (p.id === a.photoId ? { ...p, src: a.src } : p)) }))
    case 'setDiagnostic':
      return upd(a.jobId, j => ({ ...j, diagnostic: { file: a.file, pages: 0, importedAt: hhmm(new Date()), codes: j.diagnostic?.codes ?? [] } }))
    case 'addCode':
      return upd(a.jobId, j => ({
        ...j,
        diagnostic: j.diagnostic
          ? { ...j.diagnostic, codes: [...j.diagnostic.codes, a.code] }
          : { file: 'Ručný zápis', pages: 0, importedAt: hhmm(new Date()), codes: [a.code] },
      }))
    case 'closeJob':
      return upd(a.jobId, j => {
        const t = j.timer
        const secs = t.base + (t.running ? Math.floor((now() - t.startedAt) / 1000) : 0)
        const work = secs > 0
          ? [...j.work, { id: uid(), mechanicId: t.mechanicId || j.mechanicId || s.currentMechanicId, start: t.sessionStart || hhmm(new Date()), seconds: secs, note: t.note }]
          : j.work
        return { ...j, status: 'unpaid', work, timer: { ...t, running: false, base: 0, startedAt: 0, sessionStart: '', note: '' } }
      })
    case 'addJob':
      return { ...s, jobs: [a.job, ...s.jobs] }
    case 'setRate':
      return { ...s, hourlyRate: a.rate }
    case 'reset':
      return initial()
  }
}

interface Ctx {
  state: WorkshopState
  dispatch: Dispatch<Action>
  mechanicById: (id?: string) => Mechanic | undefined
  mechName: (id?: string) => string
}

const WorkshopContext = createContext<Ctx | null>(null)

export function WorkshopProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* quota or private mode: keep running in memory */ }
  }, [state])

  const value = useMemo<Ctx>(() => {
    const mechanicById = (id?: string) => state.mechanics.find(m => m.id === id)
    const mechName = (id?: string) => mechanicById(id)?.name.split(' ')[0] ?? '—'
    return { state, dispatch, mechanicById, mechName }
  }, [state])

  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>
}

export function useWorkshop(): Ctx {
  const c = useContext(WorkshopContext)
  if (!c) throw new Error('useWorkshop must be used inside WorkshopProvider')
  return c
}

/** A clock that ticks once a second while `active`; otherwise a frozen `now`. */
export function useNow(active = true) {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setT(Date.now())
    const id = setInterval(() => setT(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return t
}

export const elapsedOf = (j: Job, at: number) =>
  j.timer.base + (j.timer.running ? Math.max(0, Math.floor((at - j.timer.startedAt) / 1000)) : 0)

export function totalsOf(j: Job, rate: number, at: number) {
  const elapsed = elapsedOf(j, at)
  const workSec = j.work.reduce((a, w) => a + w.seconds, 0)
  const totalSec = workSec + elapsed
  const labor = (totalSec / 3600) * rate
  const partsSum = j.parts.filter(p => p.used).reduce((a, p) => a + p.price, 0)
  return { elapsed, totalSec, labor, partsSum, grand: labor + partsSum }
}
