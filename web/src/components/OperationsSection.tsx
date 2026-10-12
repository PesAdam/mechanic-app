import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useOperations, useOrderActions } from '../data/queries'
import { useAction } from '../lib/useAction'
import { carName, normSeconds } from '../lib/calc'
import { hm } from '../lib/format'
import type { Order } from '../lib/types'
import AddOperationDialog from './AddOperationDialog'

interface Props { order: Order; closed: boolean; title?: boolean }

/** The jobs on an order: tick when done, norms add up to what the stopwatch is measured against. */
export default function OperationsSection({ order, closed, title = true }: Props) {
  const catalog = useOperations(order.car.car_model_id, order.car.car_engine_id)
  const actions = useOrderActions()
  const act = useAction()
  const [addOpen, setAddOpen] = useState(false)
  const norm = normSeconds(order)
  const avgOf = (operationId: number | null) => (operationId ? catalog.data?.find(o => o.id === operationId) : undefined)

  return (
    <>
      {title && (
        <div className="sec-head"><h4 style={{ margin: 0 }}>Úkony</h4><span className="muted" style={{ fontSize: 13 }}>{norm ? `norma ${hm(norm)}` : 'bez normy'}</span></div>
      )}
      <div>
        {(order.operations ?? []).map(op => {
          const cat = avgOf(op.operation_id)
          return (
            <div key={op.id} className="op-row">
              <button type="button" className="part-box" style={{ background: op.done ? 'var(--color-accent)' : 'transparent', cursor: closed ? 'default' : 'pointer' }}
                onClick={() => void act.run(() => actions.updateOrderOperation(op.id, { done: !op.done }))} disabled={closed || act.busy} aria-pressed={op.done} aria-label={op.done ? 'Hotové' : 'Nehotové'}>
                {op.done && <Check size={12} strokeWidth={2.5} color="#fff" />}
              </button>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500, textDecoration: op.done ? 'line-through' : 'none', opacity: op.done ? 0.7 : 1 }}>{op.name}</span>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>norma {hm(op.norm_minutes * 60)}{cat?.car_avg_seconds ? ` · priemer na ${carName(order.car)}: ${hm(cat.car_avg_seconds)} (${cat.car_samples_count}×)` : cat?.avg_seconds ? ` · tvoj priemer ${hm(cat.avg_seconds)} (${cat.samples_count}×)` : ''}</span>
              </span>
              {!closed && (
                <button type="button" className="btn btn-ghost btn-icon" style={{ width: 32, height: 32 }} aria-label="Odstrániť úkon" disabled={act.busy}
                  onClick={() => void act.run(() => actions.removeOrderOperation(op.id))}><X size={14} strokeWidth={1.5} /></button>
              )}
            </div>
          )
        })}
        {!(order.operations ?? []).length && <div className="muted" style={{ fontSize: 13, padding: '6px 0' }}>Bez úkonov. Pridajte ich, aby stopky vedeli, koľko má práca trvať.</div>}
      </div>
      {act.error && <div className="form-error" role="alert">{act.error}</div>}
      {!closed && <button className="btn btn-ghost" style={{ marginTop: 6, minHeight: 44, alignSelf: 'flex-start' }} onClick={() => setAddOpen(true)}>+ Pridať úkon</button>}
      <AddOperationDialog open={addOpen} onClose={() => setAddOpen(false)} orderId={order.id} carModelId={order.car.car_model_id} carEngineId={order.car.car_engine_id} carLabel={carName(order.car)} />
    </>
  )
}
