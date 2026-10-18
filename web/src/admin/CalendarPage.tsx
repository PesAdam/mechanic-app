import { useMemo, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useOrderActions, useOrders } from '../data/queries'
import { useNow } from '../lib/useNow'
import { useAction } from '../lib/useAction'
import { byPlan, carName, firstName, isClosed, isRunning, plannedMinutes } from '../lib/calc'
import { addDays, dateOf, hhmm, isoDate, isoWeek, localToIso, skDateShort, timeOf, WEEKDAYS_SHORT } from '../lib/format'
import { plural } from '../lib/text'
import type { Order } from '../lib/types'
import Blueprint from '../components/Blueprint'
import Dialog from '../components/Dialog'
import StatusTag from '../components/StatusTag'

const DAY_START = 7
const DAY_END = 18
const HOUR_PX = 56
const DAYS = 7

interface PlanDraft { order: Order | null; date: string; time: string }

/** Kalendár: the week's planned orders on a time grid (Monday to Sunday, so a weekend plan never hides), the unplanned open ones beside it. */
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
              {days.map(d => (
                <div key={d} className={`cal-head${d === today ? ' today' : ''}`}>{WEEKDAYS_SHORT[new Date(d + 'T12:00:00').getDay()]}<b>{Number(d.slice(8, 10))}</b></div>
              ))}
              <div>
                {Array.from({ length: DAY_END - DAY_START }, (_, i) => <div key={i} className="cal-hour">{DAY_START + i}:00</div>)}
              </div>
              {days.map(d => (
                <div key={d} className={`cal-day${d === today ? ' today' : ''}`} style={{ height: (DAY_END - DAY_START) * HOUR_PX }} onClick={e => pickSlot(d, e)} role="presentation">
                  {planned.filter(o => dateOf(o.planned_at as string) === d).map(o => {
                    const start = new Date(o.planned_at as string)
                    const startMin = start.getHours() * 60 + start.getMinutes()
                    const top = Math.max(0, ((startMin - DAY_START * 60) / 60) * HOUR_PX)
                    const height = Math.max(28, (plannedMinutes(o) / 60) * HOUR_PX)
                    const cls = isRunning(o) ? ' live' : isClosed(o) ? ' closed' : o.status !== 'open' ? ' waiting' : ''
                    return (
                      <button key={o.id} type="button" className={`cal-block${cls}`} style={{ top, height }} title={`#${o.number} · ${carName(o.car)} · ${o.summary}`}
                        onClick={() => setDraft({ order: o, date: d, time: hhmm(start) })}>
                        <b>{hhmm(start)} · {carName(o.car)}</b>
                        <span>#{o.number} · {o.customer.name}{o.mechanic ? ` · ${firstName(o.mechanic.name)}` : ''}</span>
                      </button>
                    )
                  })}
                  {d === today && nowMinutes >= DAY_START * 60 && nowMinutes <= DAY_END * 60 && <div className="cal-now" style={{ top: ((nowMinutes - DAY_START * 60) / 60) * HOUR_PX }} />}
                </div>
              ))}
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12, padding: '10px 14px' }}>Kliknutím do voľného miesta naplánujete zákazku na ten čas; kliknutím na blok zmeníte jej plán. Výška bloku = plánované trvanie (inak súčet noriem úkonov).</div>
        </Blueprint>

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

      {draft && <PlanDialog draft={draft} candidates={unplanned} busy={act.busy} onClose={() => setDraft(null)}
        onSave={(order, patch) => void act.run(() => actions.updateOrder(order.id, patch)).then(() => setDraft(null))} />}
    </div>
  )
}

/** Date, time and duration of one order's plan; without an order it first asks which unplanned one to place. */
function PlanDialog({ draft, candidates, busy, onClose, onSave }: { draft: PlanDraft; candidates: Order[]; busy: boolean; onClose: () => void; onSave: (order: Order, patch: { planned_at: string | null; planned_minutes: number | null }) => void }) {
  const [orderId, setOrderId] = useState<number | ''>(draft.order?.id ?? (candidates[0]?.id ?? ''))
  const [date, setDate] = useState(draft.date)
  const [time, setTime] = useState(draft.time)
  const [minutes, setMinutes] = useState(draft.order?.planned_minutes ? String(draft.order.planned_minutes) : '')
  const order = draft.order ?? candidates.find(o => o.id === orderId) ?? null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!order || !date) return
    const m = parseInt(minutes, 10)
    onSave(order, { planned_at: localToIso(date, time), planned_minutes: m > 0 ? m : null })
  }

  return (
    <Dialog open title={draft.order ? `Plán · #${draft.order.number}` : 'Naplánovať zákazku'} onClose={onClose}
      actions={<>
        {draft.order?.planned_at && <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} disabled={busy} onClick={() => onSave(draft.order as Order, { planned_at: null, planned_minutes: null })}>Zrušiť plán</button>}
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Zavrieť</button>
        <button type="submit" form="plan-form" className="btn btn-primary" disabled={busy || !order || !date}>Uložiť</button>
      </>}>
      <form id="plan-form" onSubmit={submit}>
        {draft.order
          ? <div style={{ fontSize: 13 }}><b>{carName(draft.order.car)}</b> · {draft.order.customer.name}<div className="muted" style={{ fontSize: 12 }}>{draft.order.summary} · <Link to={`/admin/zakazky/${draft.order.id}`}>otvoriť zákazku</Link></div></div>
          : <div className="field"><label htmlFor="pl-order">Zákazka</label>
            <select id="pl-order" className="input" value={orderId} onChange={e => setOrderId(e.target.value ? Number(e.target.value) : '')}>
              {!candidates.length && <option value="">— žiadna nenaplánovaná zákazka —</option>}
              {candidates.map(o => <option key={o.id} value={o.id}>#{o.number} · {carName(o.car)} · {o.customer.name}</option>)}
            </select>
          </div>}
        <div className="row">
          <div className="field"><label htmlFor="pl-date">Dátum</label><input id="pl-date" className="input" type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
          <div className="field"><label htmlFor="pl-time">Čas</label><input id="pl-time" className="input" type="time" step={300} value={time} onChange={e => setTime(e.target.value)} required /></div>
        </div>
        <div className="field"><label htmlFor="pl-min">Trvanie (min)</label><input id="pl-min" className="input" type="number" inputMode="numeric" min={5} step={5} value={minutes} onChange={e => setMinutes(e.target.value)} placeholder={order ? `podľa noriem ${plannedMinutes(order)}` : ''} /></div>
        {order?.planned_at && <div className="muted" style={{ fontSize: 12 }}>Teraz naplánované na {skDateShort(dateOf(order.planned_at))} {timeOf(order.planned_at)}.</div>}
      </form>
    </Dialog>
  )
}

/** Monday of the week that holds the given local day. */
function mondayOfDay(day: string): string {
  const d = new Date(day + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoDate(d)
}
