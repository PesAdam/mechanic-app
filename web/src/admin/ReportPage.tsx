import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Check, ChevronLeft, Copy, Printer } from 'lucide-react'
import { useOrder, useOrderActions, useSettings } from '../data/queries'
import { useNow } from '../lib/useNow'
import { useAction } from '../lib/useAction'
import { isRunning } from '../lib/calc'
import { copyText, publicReportUrl } from '../lib/share'
import Blueprint, { Corners } from '../components/Blueprint'
import ReportView from '../screens/ReportView'

export default function ReportPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const q = useOrder(orderId)
  const settings = useSettings()
  const actions = useOrderActions()
  const act = useAction()
  const order = q.data
  const now = useNow(!!order && isRunning(order))
  const [copied, setCopied] = useState(false)

  if (!order || !settings.data) {
    return <Blueprint style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>{q.isPending || settings.isPending ? 'Načítavam report…' : 'Report sa nenašiel.'}</div></Blueprint>
  }

  const copy = async () => { if (await copyText(publicReportUrl(order.public_token))) { setCopied(true); setTimeout(() => setCopied(false), 2000) } }

  return (
    <ReportView order={order} settings={settings.data} now={now} tools={<>
      <Link to="/admin/reporty" className="btn btn-secondary"><ChevronLeft size={16} strokeWidth={1.5} />Reporty</Link>
      <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
        {order.status === 'unpaid' && <button className="btn btn-secondary" disabled={act.busy} onClick={() => void act.run(() => actions.updateOrder(order.id, { status: 'done' }))}><Check size={16} strokeWidth={1.5} />Označiť ako uhradené</button>}
        <button className="btn btn-secondary" onClick={() => void copy()}><Copy size={16} strokeWidth={1.5} />{copied ? 'Skopírované ✓' : 'Kopírovať odkaz'}</button>
        <button className="btn btn-primary blueprint" onClick={() => window.print()}><Corners /><Printer size={16} strokeWidth={1.5} />Tlačiť / PDF</button>
      </span>
    </>} />
  )
}
