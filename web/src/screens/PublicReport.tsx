import { useParams } from 'react-router'
import { Printer } from 'lucide-react'
import { usePublicReport } from '../data/queries'
import { useNow } from '../lib/useNow'
import { isRunning } from '../lib/calc'
import { Corners } from '../components/Blueprint'
import NotFound from '../components/NotFound'
import { Loading } from '../components/Loading'
import ReportView from './ReportView'

/** The customer's view: no login, reachable only by the unguessable token. */
export default function PublicReport() {
  const { token = '' } = useParams()
  const q = usePublicReport(token)
  const now = useNow(!!q.data && isRunning(q.data.order))

  if (!q.data) return q.isPending ? <Loading text="Načítavam report…" /> : <NotFound what="Report" />

  return (
    <ReportView order={q.data.order} settings={q.data.settings} now={now} tools={<>
      <span className="muted" style={{ fontSize: 13 }}>Servisný report #{q.data.order.number}</span>
      <button className="btn btn-primary blueprint" onClick={() => window.print()}><Corners /><Printer size={16} strokeWidth={1.5} />Tlačiť / PDF</button>
    </>} />
  )
}
