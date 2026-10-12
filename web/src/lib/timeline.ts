import type { Order, Part, Photo } from './types'
import { eur, hm, hms, timeOf } from './format'
import { lowerFirst } from './text'
import { entrySeconds, firstName } from './calc'

export interface TimelineEvent {
  id: string
  time: string
  sort: number
  title: string
  text?: string
  right?: string
  photos?: Photo[]
  live?: boolean
}

const STAGE_TITLE = { pred: 'Fotky pred prácou', pocas: 'Fotky počas práce', po: 'Fotky po práci' } as const

/** Every record of an order in time order, with running stopwatches last. */
export function buildTimeline(order: Order, now: number): TimelineEvent[] {
  const evs: TimelineEvent[] = []

  if (order.received_at) {
    evs.push({ id: 'recv', time: timeOf(order.received_at), sort: Date.parse(order.received_at), title: 'Príjem auta',
      text: `${order.car.make} ${order.car.model} · ${order.car.plate} · ${lowerFirst(order.summary)}` })
  }

  if (order.diagnostic) {
    const d = order.diagnostic
    evs.push({ id: 'diag', time: timeOf(d.imported_at), sort: Date.parse(d.imported_at), title: 'Import diagnostiky',
      text: [d.file_name, ...d.codes.map(c => `${c.code}${c.description ? ' ' + lowerFirst(c.description) : ''}`)].join(' · ') })
  }

  const photoGroups = new Map<string, Photo[]>()
  for (const p of order.photos) {
    const k = `${timeOf(p.taken_at)}|${p.stage}`
    const g = photoGroups.get(k) ?? []
    g.push(p)
    photoGroups.set(k, g)
  }
  for (const [k, photos] of photoGroups) {
    const [time, stage] = k.split('|') as [string, keyof typeof STAGE_TITLE]
    evs.push({ id: `ph-${k}`, time, sort: Date.parse(photos[0].taken_at), title: STAGE_TITLE[stage] ?? 'Fotky', photos })
  }

  for (const e of order.work_entries) {
    if (!e.ended_at) continue
    evs.push({ id: `w-${e.id}`, time: timeOf(e.started_at), sort: Date.parse(e.started_at),
      title: `Práca · ${firstName(e.user.name)}${e.manual ? ' · ručne' : ''}`, right: hm(e.seconds), text: e.note ?? undefined })
  }

  const partGroups = new Map<string, Part[]>()
  for (const p of order.parts) {
    const k = timeOf(p.added_at)
    const g = partGroups.get(k) ?? []
    g.push(p)
    partGroups.set(k, g)
  }
  for (const [time, parts] of partGroups) {
    const sum = parts.filter(p => p.used).reduce((a, p) => a + p.price, 0)
    evs.push({ id: `pt-${time}`, time, sort: Date.parse(parts[0].added_at), title: 'Diely', right: eur(sum), text: parts.map(p => p.name).join(', ') })
  }

  evs.sort((a, b) => a.sort - b.sort)

  for (const e of order.work_entries) {
    if (e.ended_at) continue
    evs.push({ id: `live-${e.id}`, time: 'teraz', sort: Number.MAX_SAFE_INTEGER, title: `Práca · ${firstName(e.user.name)} · beží`,
      right: hms(entrySeconds(e, now)), text: e.note ?? undefined, live: true })
  }
  return evs
}
