import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useOrders, useSettings, useUsers } from '../data/queries'
import { useNow } from '../lib/useNow'
import { entrySeconds, firstName, isClosed, isRunning, runningEntry, totalsOf, carName } from '../lib/calc'
import NormBadge from '../components/NormBadge'
import { dateOf, eur, hm, hms, isoDate, skDateShort, timeOf, weekday } from '../lib/format'
import { lowerFirst, plural } from '../lib/text'
import type { LaborBilling, Order } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'
import ImageSlot from '../components/ImageSlot'
import MakeLogo from '../components/MakeLogo'
import StatusTag from '../components/StatusTag'
import NewJobDialog from '../components/NewJobDialog'
import InstallBanner from '../components/InstallBanner'
import { LoadError } from '../components/Loading'

type View = 'cars' | 'people' | 'done'
const VIEWS: [View, string][] = [['cars', 'Autá'], ['people', 'Ľudia'], ['done', 'Hotové']]

/** 1c · Dielňa dnes — cars on the lifts, who is on what, running stopwatches. */
export default function WorkshopToday() {
  const { user } = useAuth()
  const orders = useOrders()
  const settings = useSettings()
  const list = orders.data ?? []
  const rate = settings.data?.hourly_rate ?? 28
  const billing = settings.data?.labor_billing
  const now = useNow(list.some(isRunning))
  const [view, setView] = useState<View>('cars')
  const [newOpen, setNewOpen] = useState(false)
  const nav = useNavigate()

  const today = isoDate(new Date(now))
  const rank = (o: Order) => (isRunning(o) ? 0 : o.status === 'open' ? 1 : 2)
  const active = list.filter(o => !isClosed(o)).sort((a, b) => rank(a) - rank(b) || Date.parse(a.received_at ?? '') - Date.parse(b.received_at ?? ''))
  const finished = list.filter(isClosed)
  const todaySec = list.reduce((a, o) => a + o.work_entries.filter(e => dateOf(e.started_at) === today).reduce((x, e) => x + entrySeconds(e, now), 0), 0)
  const runningMechs = new Set(list.flatMap(o => o.work_entries.filter(e => !e.ended_at).map(e => e.user.id))).size

  return (
    <div className="phone">
      <div className="screen" style={{ gap: 16 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="kicker">{weekday(today)} {skDateShort(today)}</div>
            <h1 style={{ fontSize: 40, margin: 0, lineHeight: 1 }}>Dielňa</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="kicker-muted">Dnes</div>
            <div className="hd num" style={{ fontSize: 22, lineHeight: 1.1 }}>{hm(todaySec)}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {active.length} {plural(active.length, 'auto', 'autá', 'áut')} · {runningMechs} {plural(runningMechs, 'mechanik', 'mechanici', 'mechanikov')}
            </div>
            <Link to="/m/ucet" className="muted" style={{ fontSize: 12 }}>{firstName(user?.name)} · účet</Link>
          </div>
        </header>

        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          {VIEWS.map(([v, label]) => (
            <label key={v} className="seg-opt">
              <input type="radio" name="c-view" checked={view === v} onChange={() => setView(v)} />{label}
            </label>
          ))}
        </div>

        <InstallBanner />

        {orders.isError && list.length > 0 && <div className="muted" style={{ fontSize: 12 }}>Bez spojenia so serverom · zobrazený posledný známy stav.</div>}
        {orders.isPending && !list.length && <Blueprint style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>Načítavam zákazky…</div></Blueprint>}
        {orders.isError && !list.length && <LoadError text="Zákazky sa nepodarilo načítať." onRetry={() => void orders.refetch()} />}

        {view === 'cars' && list.length > 0 && (active.length
          ? active.map(o => <JobCard key={o.id} order={o} now={now} rate={rate} billing={billing} />)
          : <Empty>Žiadne otvorené zákazky. Založte novú tlačidlom nižšie.</Empty>)}
        {view === 'people' && <PeopleView orders={list} now={now} today={today} />}
        {view === 'done' && list.length > 0 && (finished.length
          ? finished.map(o => <FinishedCard key={o.id} order={o} now={now} rate={rate} billing={billing} />)
          : <Empty>Zatiaľ nič uzavreté.</Empty>)}

        <button className="btn btn-primary btn-block blueprint" style={{ minHeight: 48, fontSize: 15, marginTop: 'auto' }} onClick={() => setNewOpen(true)}>
          <Corners />+ Nová zákazka (VIN / ŠPZ)
        </button>
      </div>
      <NewJobDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={id => nav(`/m/zakazky/${id}`)} />
    </div>
  )
}

function Empty({ children }: { children: string }) {
  return <Blueprint style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>{children}</div></Blueprint>
}

function JobCard({ order, now, rate, billing }: { order: Order; now: number; rate: number; billing?: LaborBilling }) {
  const t = totalsOf(order, rate, now, billing)
  const run = runningEntry(order)
  const waiting = order.status !== 'open'
  const cover = order.photos.find(p => p.url)
  const receivedToday = order.received_at && dateOf(order.received_at) === isoDate(new Date(now))
  return (
    <Link to={`/m/zakazky/${order.id}`} className="card blueprint job-card" style={{ padding: 14, gap: 10, opacity: waiting ? 0.75 : 1 }}>
      <Corners />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="card-kicker">{order.lift ?? (waiting ? 'Čaká' : 'Dielňa')} · #{order.number}</span>
        {run
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-accent-700)' }}><i className="dot live" />{firstName(run.user.name)} · <span className="num">{hms(entrySeconds(run, now))}</span></span>
          : waiting
            ? <StatusTag status={order.status} />
            : <span style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{firstName(order.mechanic?.name)} · pauza</span>}
      </div>
      {waiting ? (
        <div style={{ minWidth: 0 }}>
          <div className="card-title">{carName(order.car)}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {order.customer.name} · {order.car.plate} · {lowerFirst(order.summary)}{order.received_at ? `, príjem ${receivedToday ? timeOf(order.received_at) : skDateShort(dateOf(order.received_at))}` : ''}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12 }}>
            {cover && <ImageSlot src={cover.url} label="Auto" style={{ width: 88, height: 66, flex: 'none' }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MakeLogo name={order.car.make} url={order.car.logo_url} size={22} decorative />{carName(order.car)}</div>
              <div className="muted" style={{ fontSize: 12 }}>{order.customer.name} · {order.car.plate}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{order.summary}</div>
            </div>
          </div>
          <div className="card-foot">
            <span>Čas <b>{hm(t.seconds)}</b></span>
            <span>Diely <b>{eur(t.parts)}</b></span>
            <span>Fotky <b>{order.photos.length}</b></span>
            {t.norm_seconds > 0 && <NormBadge seconds={t.seconds} normSeconds={t.norm_seconds} rate={rate} />}
            {order.diagnostic && <span className="tag tag-accent" style={{ marginLeft: 'auto' }}>{order.diagnostic.file_url ? 'PDF diag.' : 'Diag.'}</span>}
          </div>
        </>
      )}
    </Link>
  )
}

function FinishedCard({ order, now, rate, billing }: { order: Order; now: number; rate: number; billing?: LaborBilling }) {
  const t = totalsOf(order, rate, now, billing)
  return (
    <Link to={`/m/zakazky/${order.id}`} className="card blueprint job-card" style={{ padding: 14, gap: 10 }}>
      <Corners />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="card-kicker">{order.closed_at ? skDateShort(dateOf(order.closed_at)) : ''} · #{order.number}</span>
        <StatusTag status={order.status} />
      </div>
      <div>
        <div className="card-title">{carName(order.car)}</div>
        <div className="muted" style={{ fontSize: 12 }}>{order.customer.name} · {order.car.plate} · {firstName(order.mechanic?.name)}</div>
      </div>
      <div className="card-foot">
        <span>Čas <b>{hm(t.seconds)}</b></span>
        <span>Diely <b>{eur(t.parts)}</b></span>
        <span>Spolu <b>{eur(t.grand)}</b></span>
      </div>
    </Link>
  )
}

function PeopleView({ orders, now, today }: { orders: Order[]; now: number; today: string }) {
  const users = useUsers()
  const people = (users.data ?? []).filter(u => u.is_active)
  if (users.isPending && !people.length) return <Empty>Načítavam mechanikov…</Empty>
  return (
    <>
      {people.map(m => {
        const rows = orders
          .map(o => ({ o, sec: o.work_entries.filter(e => e.user.id === m.id && dateOf(e.started_at) === today).reduce((a, e) => a + entrySeconds(e, now), 0) }))
          .filter(r => r.sec > 0)
        const total = rows.reduce((a, r) => a + r.sec, 0)
        const running = orders.find(o => o.work_entries.some(e => !e.ended_at && e.user.id === m.id))
        return (
          <Blueprint key={m.id} className="card" style={{ padding: 14, gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="card-title">{m.name}</span>
              {running
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-accent-700)' }}><i className="dot live" />beží · #{running.number}</span>
                : <span className="tag tag-neutral">voľno</span>}
            </div>
            <div className="card-foot" style={{ border: 0, padding: 0 }}>
              <span>Dnes <b>{hm(total)}</b></span>
              <span>Zákazky <b>{rows.length}</b></span>
            </div>
            {rows.map(({ o, sec }) => (
              <Link key={o.id} to={`/m/zakazky/${o.id}`} className="job-row">
                <span>#{o.number} · {carName(o.car)}</span>
                <span className="hd num">{hm(sec)}</span>
              </Link>
            ))}
          </Blueprint>
        )
      })}
    </>
  )
}
