import { useState } from 'react'
import { Check, Pause, Play, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useOperations, useOrderActions } from '../data/queries'
import { useAction } from '../lib/useAction'
import { carName, normClass, normSeconds, opSeconds, runningEntryOf } from '../lib/calc'
import { hm, hms } from '../lib/format'
import type { Order } from '../lib/types'
import AddOperationDialog from './AddOperationDialog'
import NormBadge from './NormBadge'

interface Props { order: Order; closed: boolean; title?: boolean; now: number; rate: number }

/**
 * The jobs on an order. ▶ clocks the stopwatch against one job (tapping another job switches to it),
 * ✓ ticks it off and stops its stint; the norms add up to what the whole stopwatch is measured against.
 */
export default function OperationsSection({ order, closed, title = true, now, rate }: Props) {
  const { user } = useAuth()
  const catalog = useOperations(order.car.car_model_id, order.car.car_engine_id)
  const actions = useOrderActions()
  const act = useAction()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: number; minutes: string } | null>(null)
  const saveNorm = (id: number, minutes: string) => {
    const m = Math.round(Number(minutes))
    if (!Number.isFinite(m) || m < 1 || m > 6000) return
    void act.run(async () => { await actions.updateOrderOperation(id, { norm_minutes: m }); setEditing(null) })
  }
  const norm = normSeconds(order)
  const mine = user ? runningEntryOf(order, user.id) : null
  const avgOf = (operationId: number | null) => (operationId ? catalog.data?.find(o => o.id === operationId) : undefined)

  return (
    <>
      {title && (
        <div className="sec-head"><h4 style={{ margin: 0 }}>Úkony</h4><span className="muted" style={{ fontSize: 13 }}>{norm ? `norma ${hm(norm)}` : 'bez normy'}</span></div>
      )}
      <div>
        {(order.operations ?? []).map(op => {
          const cat = avgOf(op.operation_id)
          const seconds = opSeconds(order, op.id, now)
          const live = order.work_entries.some(e => !e.ended_at && e.order_operation_id === op.id)
          const mineHere = mine?.order_operation_id === op.id
          const avg = cat?.car_avg_seconds ? ` · priemer na ${carName(order.car)}: ${hm(cat.car_avg_seconds)} (${cat.car_samples_count}×)` : cat?.avg_seconds ? ` · tvoj priemer ${hm(cat.avg_seconds)} (${cat.samples_count}×)` : ''
          return (
            <div key={op.id} className="op-row">
              <button type="button" className="part-box" style={{ background: op.done ? 'var(--color-accent)' : 'transparent', cursor: closed ? 'default' : 'pointer' }}
                onClick={() => void act.run(() => actions.updateOrderOperation(op.id, { done: !op.done }))} disabled={closed || act.busy} aria-pressed={op.done} aria-label={op.done ? 'Hotové' : 'Nehotové'}>
                {op.done && <Check size={12} strokeWidth={2.5} color="#fff" />}
              </button>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, textDecoration: op.done ? 'line-through' : 'none', opacity: op.done ? 0.7 : 1 }}>
                  {live && <i className="dot live" />}{op.name}
                </span>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>
                  {(seconds > 0 || live) && <><span className={`num ${normClass(seconds, op.norm_minutes * 60)}`} style={{ fontWeight: 600 }}>{live ? hms(seconds) : hm(seconds)}</span> · </>}
                  {editing?.id === op.id ? (
                    <form style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onSubmit={e => { e.preventDefault(); saveNorm(op.id, editing.minutes) }}>
                      norma <input className="input num" type="number" inputMode="numeric" min={1} max={6000} step={5} autoFocus aria-label={`Norma v minútach · ${op.name}`}
                        style={{ width: 70, minHeight: 28, padding: '2px 6px', fontSize: 12 }} value={editing.minutes} disabled={act.busy}
                        onChange={e => setEditing({ id: op.id, minutes: e.target.value })} onKeyDown={e => { if (e.key === 'Escape') setEditing(null) }} /> min
                      <button type="submit" className="linkbtn" disabled={act.busy}>Uložiť</button>
                      <button type="button" className="linkbtn" onClick={() => setEditing(null)}>Zrušiť</button>
                    </form>
                  ) : !closed && op.operation_id ? (
                    <button type="button" className="linkbtn" style={{ fontSize: 11 }} title={`Upraviť normu · zapamätá sa pre ${carName(order.car)}`}
                      onClick={() => setEditing({ id: op.id, minutes: String(op.norm_minutes) })}>norma {hm(op.norm_minutes * 60)}</button>
                  ) : <>norma {hm(op.norm_minutes * 60)}</>}
                  {seconds > 0 && <> · <NormBadge seconds={seconds} normSeconds={op.norm_minutes * 60} rate={rate} size={11} /></>}
                  {avg}
                </span>
              </span>
              {!closed && !op.done && (mineHere
                ? <button type="button" className="btn btn-secondary btn-icon" aria-label={`Pauza · ${op.name}`} title="Pauza" disabled={act.busy}
                    onClick={() => void act.run(() => actions.stopTimer(order.id))}><Pause size={16} strokeWidth={1.5} /></button>
                : <button type="button" className="btn btn-ghost btn-icon" aria-label={`Štart · ${op.name}`} title={mine ? 'Prepnúť stopky na tento úkon' : 'Spustiť stopky na tento úkon'} disabled={act.busy}
                    onClick={() => void act.run(() => actions.startTimer(order.id, { order_operation_id: op.id }))}><Play size={16} strokeWidth={1.5} /></button>)}
              {!closed && seconds === 0 && !live && (
                <button type="button" className="btn btn-ghost btn-icon" style={{ width: 32, height: 32 }} aria-label="Odstrániť úkon" title="Odstrániť úkon zo zákazky" disabled={act.busy}
                  onClick={() => { if (window.confirm(`Odstrániť úkon „${op.name}“ zo zákazky?`)) void act.run(() => actions.removeOrderOperation(op.id)) }}><X size={14} strokeWidth={1.5} /></button>
              )}
            </div>
          )
        })}
        {!(order.operations ?? []).length && <div className="muted" style={{ fontSize: 13, padding: '6px 0' }}>Bez úkonov. Pridajte ich, aby stopky vedeli, koľko má práca trvať, a dali sa spúšťať na konkrétny úkon.</div>}
      </div>
      {act.error && <div className="form-error" role="alert">{act.error}</div>}
      {!closed && <button className="btn btn-ghost" style={{ marginTop: 6, minHeight: 44, alignSelf: 'flex-start' }} onClick={() => setAddOpen(true)}>+ Pridať úkon</button>}
      <AddOperationDialog open={addOpen} onClose={() => setAddOpen(false)} orderId={order.id} carModelId={order.car.car_model_id} carEngineId={order.car.car_engine_id} carLabel={carName(order.car)} />
    </>
  )
}
