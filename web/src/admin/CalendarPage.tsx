import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useOrderActions, useOrders } from '../data/queries'
import { useNow } from '../lib/useNow'
import { useAction } from '../lib/useAction'
import { byPlan, carName, firstName, isClosed, isOverdue, isRunning, plannedMinutes } from '../lib/calc'
import { addDays, dateOf, hhmm, isoDate, isoWeek, planLabel, skDateShort, WEEKDAYS_SHORT } from '../lib/format'
import { plural } from '../lib/text'
import type { Order } from '../lib/types'
import Blueprint from '../components/Blueprint'
import PlanDialog, { type PlanDraft } from '../components/PlanDialog'
import StatusTag from '../components/StatusTag'

const DAY_START = 7
const DAY_END = 18
const HOUR_PX = 56
const DAYS = 7

interface Block { order: Order; top: number; height: number; startMin: number; endMin: number; lane: number; lanes: number }

/** Kalendár: the week's planned orders on a time grid (Monday to Sunday, so a weekend plan never hides), the unplanned and slipped ones beside it. */
export default function CalendarPage() {
  const orders = useOrders()
  const actions = useOrderActions()
  const act = useAction()
  const list = orders.data ?? []
  const now = useNow(list.some(isRunning))
  const today = isoDate(new Date(now))
  const [monday, setMonday] = useState(() => mondayOfDay(today))
  const [draft, setDraft] = useState<PlanDraft | null>(null)

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(monday, i)), [monday])
  const planned = useMemo(() => list.filter(o => o.planned_at && days.includes(dateOf(o.planned_at))), [list, days])
  const unplanned = useMemo(() => list.filter(o => !isClosed(o) && !o.planned_at).sort(byPlan), [list])
  const overdue = useMemo(() => list.filter(o => isOverdue(o, now)).sort(byPlan), [list, now])
  const weekLabel = `Týždeň ${isoWeek(monday)} · ${skDateShort(days[0])}–${skDateShort(days[DAYS - 1])} ${days[0].slice(0, 4)}`
  const nowMinutes = new Date(now).getHours() * 60 + new Date(now).getMinutes()

  // Click on an empty part of a day: plan something there, rounded to half an hour.
  const pickSlot = (day: string, e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const minutes = DAY_START * 60 + Math.round(((e.clientY - rect.top) / HOUR_PX) * 2) * 30
    const clamped = Math.min(DAY_END * 60 - 30, Math.max(DAY_START * 60, minutes))
    setDraft({ order: null, date: day, time: `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}` })
  }

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div><div className="kicker">{weekLabel}</div><h1>Kalendár</h1></div>
        <div className="admin-actions">
          <button className="btn btn-secondary btn-icon" aria-label="Predchádzajúci týždeň" onClick={() => setMonday(addDays(monday, -7))}><ChevronLeft size={16} strokeWidth={1.5} /></button>
          <button className="btn btn-secondary" style={{ minHeight: 36 }} onClick={() => setMonday(mondayOfDay(today))}>Dnes</button>
          <button className="btn btn-secondary btn-icon" aria-label="Nasledujúci týždeň" onClick={() => setMonday(addDays(monday, 7))}><ChevronRight size={16} strokeWidth={1.5} /></button>
        </div>
      </div>
      {act.error && <div className="form-error" role="alert">{act.error}</div>}

      <div className="cal">
        <Blueprint className="card" style={{ padding: 0, gap: 0 }}>
          <div className="cal-scroll">
            <div className="cal-grid" style={{ '--hour': `${HOUR_PX}px` } as CSSProperties}>
              <div />
              {days.map(d => {
                const load = planned.filter(o => dateOf(o.planned_at as string) === d).reduce((a, o) => a + plannedMinutes(o), 0)
                return (
                  <div key={d} className={`cal-head${d === today ? ' today' : ''}`}>
                    {WEEKDAYS_SHORT[new Date(d + 'T12:00:00').getDay()]}<b>{Number(d.slice(8, 10))}</b>
                    <span className="cal-load">{load ? `${Math.floor(load / 60)} h ${String(load % 60).padStart(2, '0')} min` : ' '}</span>
                  </div>
                )
              })}
              <div>
                {Array.from({ length: DAY_END - DAY_START }, (_, i) => <div key={i} className="cal-hour">{DAY_START + i}:00</div>)}
              </div>
              {days.map(d => (
                <div key={d} className={`cal-day${d === today ? ' today' : ''}`} style={{ height: (DAY_END - DAY_START) * HOUR_PX }} onClick={e => pickSlot(d, e)} role="presentation">
                  {layout(planned.filter(o => dateOf(o.planned_at as string) === d)).map(b => {
                    const o = b.order
                    const cls = isRunning(o) ? ' live' : isClosed(o) ? ' closed' : o.status !== 'open' ? ' waiting' : ''
                    return (
                      <button key={o.id} type="button" className={`cal-block${cls}`} title={`#${o.number} · ${carName(o.car)} · ${o.summary}`}
                        style={{ top: b.top, height: b.height, left: `calc(${(b.lane / b.lanes) * 100}% + 3px)`, width: `calc(${100 / b.lanes}% - 6px)` }}
                        onClick={() => setDraft({ order: o, date: d, time: hhmm(new Date(o.planned_at as string)) })}>
                        <b>{hhmm(new Date(o.planned_at as string))} · {carName(o.car)}</b>
                        <span>{o.lift ? `${o.lift} · ` : ''}#{o.number} · {o.customer.name}{o.mechanic ? ` · ${firstName(o.mechanic.name)}` : ''}</span>
                        <span className="muted">{o.summary}</span>
                      </button>
                    )
                  })}
                  {d === today && nowMinutes >= DAY_START * 60 && nowMinutes <= DAY_END * 60 && <div className="cal-now" style={{ top: ((nowMinutes - DAY_START * 60) / 60) * HOUR_PX }} />}
                </div>
              ))}
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12, padding: '10px 14px' }}>Kliknutím do voľného miesta naplánujete zákazku na ten čas; kliknutím na blok zmeníte jej plán. Výška bloku = plánované trvanie (inak súčet noriem úkonov); zákazky v rovnakom čase stoja vedľa seba. Pod dňom je súčet naplánovaného času.</div>
        </Blueprint>

        <div className="order-col">
          {overdue.length > 0 && (
            <Blueprint className="card" style={{ padding: '16px 18px', gap: 8 }}>
              <div className="sec-head" style={{ marginBottom: 0 }}><span className="card-title norm-bad">Nestihnuté</span><span className="muted" style={{ fontSize: 12 }}>{overdue.length} {plural(overdue.length, 'zákazka', 'zákazky', 'zákaziek')}</span></div>
              <div>
                {overdue.map(o => (
                  <div key={o.id} className="plan-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Link to={`/admin/zakazky/${o.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>#{o.number} · {carName(o.car)}</Link></div>
                      <div className="muted" style={{ fontSize: 11 }}><span className="norm-bad">plán {planLabel(o.planned_at as string, now)}</span> · {o.summary}</div>
                    </div>
                    <button className="btn btn-secondary" style={{ minHeight: 30, flex: 'none' }} onClick={() => setDraft({ order: o, date: today, time: '08:00' })}>Preplánovať</button>
                  </div>
                ))}
              </div>
            </Blueprint>
          )}
          <Blueprint className="card" style={{ padding: '16px 18px', gap: 8 }}>
            <div className="sec-head" style={{ marginBottom: 0 }}><span className="card-title">Nenaplánované</span><span className="muted" style={{ fontSize: 12 }}>{unplanned.length} {plural(unplanned.length, 'zákazka', 'zákazky', 'zákaziek')}</span></div>
            <div>
              {unplanned.map(o => (
                <div key={o.id} className="plan-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Link to={`/admin/zakazky/${o.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>#{o.number} · {carName(o.car)}</Link></div>
                    <div className="muted" style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}><StatusTag status={o.status} />{o.summary}</div>
                  </div>
                  <button className="btn btn-secondary" style={{ minHeight: 30, flex: 'none' }} onClick={() => setDraft({ order: o, date: today, time: '08:00' })}>Naplánovať</button>
                </div>
              ))}
              {!unplanned.length && <div className="muted" style={{ fontSize: 13 }}>{orders.isPending ? 'Načítavam…' : 'Všetky otvorené zákazky majú plán.'}</div>}
            </div>
          </Blueprint>
        </div>
      </div>

      {draft && <PlanDialog draft={draft} candidates={unplanned} busy={act.busy} onClose={() => setDraft(null)}
        onSave={(order, patch) => void act.run(() => actions.updateOrder(order.id, patch)).then(() => setDraft(null))} />}
    </div>
  )
}

/** Greedy lane packing: blocks that overlap in time share the column width instead of hiding each other. */
function layout(orders: Order[]): Block[] {
  const blocks: Block[] = orders
    .map(o => {
      const start = new Date(o.planned_at as string)
      const startMin = start.getHours() * 60 + start.getMinutes()
      const endMin = startMin + plannedMinutes(o)
      return { order: o, startMin, endMin, top: Math.max(0, ((startMin - DAY_START * 60) / 60) * HOUR_PX), height: Math.max(28, (plannedMinutes(o) / 60) * HOUR_PX), lane: 0, lanes: 1 }
    })
    .sort((a, b) => a.startMin - b.startMin || a.order.id - b.order.id)
  // Clusters of transitively overlapping blocks share the same lane count.
  let cluster: Block[] = []
  let clusterEnd = -1
  const laneEnds: number[] = []
  const close = () => { for (const b of cluster) b.lanes = laneEnds.length; cluster = []; laneEnds.length = 0 }
  for (const b of blocks) {
    if (cluster.length && b.startMin >= clusterEnd) close()
    let lane = laneEnds.findIndex(end => end <= b.startMin)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0) }
    laneEnds[lane] = b.endMin
    b.lane = lane
    cluster.push(b)
    clusterEnd = Math.max(clusterEnd, b.endMin)
  }
  if (cluster.length) close()
  return blocks
}

/** Monday of the week that holds the given local day. */
function mondayOfDay(day: string): string {
  const d = new Date(day + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoDate(d)
}
