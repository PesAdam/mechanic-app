import type { Job, Part, Photo } from './types'
import { eur, hm, hms } from './format'
import { lowerFirst } from './text'
import { elapsedOf } from '../store/workshop'

export interface TimelineEvent {
  id: string
  time: string
  sort: string
  title: string
  text?: string
  right?: string
  photos?: Photo[]
  live?: boolean
}

const STAGE_TITLE = { pred: 'Fotky pred prácou', pocas: 'Fotky počas práce', po: 'Fotky po práci' } as const

/** Every record of a job in time order, with the running stopwatch last. */
export function buildTimeline(job: Job, mechName: (id?: string) => string, at: number): TimelineEvent[] {
  const evs: TimelineEvent[] = []

  if (job.receivedAt) evs.push({ id: 'recv', time: job.receivedAt, sort: job.receivedAt, title: 'Príjem auta', text: `${job.car.make} ${job.car.model} · ${job.car.plate} · ${lowerFirst(job.summary)}` })

  if (job.diagnostic) {
    const d = job.diagnostic
    evs.push({ id: 'diag', time: d.importedAt, sort: d.importedAt, title: 'Import diagnostiky',
      text: [d.file, ...d.codes.map(c => `${c.code} ${lowerFirst(c.desc)}`)].join(' · ') })
  }

  const photoGroups = new Map<string, Photo[]>()
  for (const p of job.photos) {
    const k = `${p.takenAt}|${p.stage}`
    const g = photoGroups.get(k) ?? []
    g.push(p)
    photoGroups.set(k, g)
  }
  for (const [k, photos] of photoGroups) {
    const [time, stage] = k.split('|') as [string, keyof typeof STAGE_TITLE]
    evs.push({ id: `ph-${k}`, time, sort: time, title: STAGE_TITLE[stage] ?? 'Fotky', photos })
  }

  for (const w of job.work) {
    evs.push({ id: w.id, time: w.start, sort: w.start, title: `Práca · ${mechName(w.mechanicId)}${w.manual ? ' · ručne' : ''}`, right: hm(w.seconds), text: w.note })
  }

  const partGroups = new Map<string, Part[]>()
  for (const p of job.parts) {
    const g = partGroups.get(p.addedAt) ?? []
    g.push(p)
    partGroups.set(p.addedAt, g)
  }
  for (const [time, parts] of partGroups) {
    const sum = parts.filter(p => p.used).reduce((a, p) => a + p.price, 0)
    evs.push({ id: `pt-${time}`, time, sort: time, title: 'Diely', right: eur(sum), text: parts.map(p => p.name).join(', ') })
  }

  evs.sort((a, b) => a.sort.localeCompare(b.sort))

  const el = elapsedOf(job, at)
  if (job.timer.running || el > 0) {
    evs.push({ id: 'live', time: job.timer.running ? 'teraz' : job.timer.sessionStart, sort: 'zz',
      title: `Práca · ${mechName(job.timer.mechanicId)} · ${job.timer.running ? 'beží' : 'pauza'}`,
      right: hms(el), text: job.timer.note, live: job.timer.running })
  }
  return evs
}
