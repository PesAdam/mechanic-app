import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { shareReport } from '../lib/share'
import type { Order } from '../lib/types'
import { Corners } from './Blueprint'

/** "Zdieľať report": the customer gets the public link, nothing to print on a phone. */
export default function ShareReport({ order, primary = true }: { order: Order; primary?: boolean }) {
  const [state, setState] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle')
  const run = async () => {
    const r = await shareReport(order)
    setState(r)
    setTimeout(() => setState('idle'), 2500)
  }
  const label = state === 'copied' ? 'Odkaz skopírovaný ✓' : state === 'shared' ? 'Zdieľané ✓' : state === 'failed' ? 'Nepodarilo sa zdieľať' : 'Zdieľať report so zákazníkom'
  return (
    <button className={primary ? 'btn btn-primary btn-block blueprint' : 'btn btn-secondary'} style={primary ? { minHeight: 48, fontSize: 15 } : undefined} onClick={() => void run()}>
      {primary && <Corners />}<Share2 size={16} strokeWidth={1.5} />{label}
    </button>
  )
}
