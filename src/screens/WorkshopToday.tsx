import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { elapsedOf, totalsOf, useNow, useWorkshop } from '../store/workshop'
import { eur, hm, hms, isoDate, skDateShort, weekday } from '../lib/format'
import { lowerFirst, plural } from '../lib/text'
import type { Job } from '../lib/types'
import Blueprint, { Corners } from '../components/Blueprint'
import ImageSlot from '../components/ImageSlot'
import StatusTag from '../components/StatusTag'
import NewJobDialog from '../components/NewJobDialog'
import InstallBanner from '../components/InstallBanner'

type View = 'cars' | 'people' | 'done'
const VIEWS: [View, string][] = [['cars', 'Autá'], ['people', 'Ľudia'], ['done', 'Hotové']]

/** 1c · Dielňa dnes — cars on the lifts, who is on what, running stopwatches. */
export default function WorkshopToday() {
  const { state } = useWorkshop()
  const now = useNow(state.jobs.some(j => j.timer.running))
  const [view, setView] = useState<View>('cars')
  const [newOpen, setNewOpen] = useState(false)
  const nav = useNavigate()

  const today = isoDate(new Date())
  const active = state.jobs.filter(j => j.status === 'open' || j.status === 'waiting' || j.status === 'new')
  const finished = state.jobs.filter(j => j.status === 'unpaid' || j.status === 'done')
  const todaySec = state.jobs.filter(j => j.date === today).reduce((a, j) => a + totalsOf(j, state.hourlyRate, now).totalSec, 0)
  const runningMechs = new Set(state.jobs.filter(j => j.timer.running).map(j => j.timer.mechanicId)).size

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

        {view === 'cars' && (active.length
          ? active.map(j => <JobCard key={j.id} job={j} now={now} />)
          : <Empty>Žiadne otvorené zákazky. Založte novú tlačidlom nižšie.</Empty>)}
        {view === 'people' && <PeopleView now={now} today={today} />}
        {view === 'done' && (finished.length
          ? finished.map(j => <FinishedCard key={j.id} job={j} now={now} />)
          : <Empty>Zatiaľ nič uzavreté.</Empty>)}

        <button className="btn btn-primary btn-block blueprint" style={{ minHeight: 48, fontSize: 15, marginTop: 'auto' }} onClick={() => setNewOpen(true)}>
          <Corners />+ Nová zákazka (VIN / ŠPZ)
        </button>
      </div>
      <NewJobDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={id => nav(`/zakazky/${id}`)} />
    </div>
  )
}

function Empty({ children }: { children: string }) {
  return <Blueprint style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>{children}</div></Blueprint>
}

function JobCard({ job, now }: { job: Job; now: number }) {
  const { state, mechName } = useWorkshop()
  const t = totalsOf(job, state.hourlyRate, now)
  const waiting = job.status !== 'open'
  const who = mechName(job.timer.mechanicId || job.mechanicId)
  const cover = job.photos.find(p => p.src) ?? job.photos[0]
  return (
    <Link to={`/zakazky/${job.id}`} className="card blueprint job-card" style={{ padding: 14, gap: 10, opacity: waiting ? 0.75 : 1 }}>
      <Corners />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="card-kicker">{job.lift ?? (waiting ? 'Čaká' : 'Dielňa')} · #{job.id}</span>
        {job.timer.running
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-accent-700)' }}><i className="dot live" />{who} · <span className="num">{hms(t.elapsed)}</span></span>
          : waiting
            ? <StatusTag status={job.status} />
            : <span style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{who} · pauza</span>}
      </div>
      {waiting ? (
        <div style={{ minWidth: 0 }}>
          <div className="card-title">{job.car.make} {job.car.model}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {job.customer.name} · {job.car.plate} · {lowerFirst(job.summary)}{job.receivedAt ? `, príjem ${job.receivedAt}` : ''}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12 }}>
            <ImageSlot src={cover?.src} label="Auto" style={{ width: 88, height: 66, flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="card-title">{job.car.make} {job.car.model}</div>
              <div className="muted" style={{ fontSize: 12 }}>{job.customer.name} · {job.car.plate}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{job.summary}</div>
            </div>
          </div>
          <div className="card-foot">
            <span>Čas <b>{hm(t.totalSec)}</b></span>
            <span>Diely <b>{eur(t.partsSum)}</b></span>
            <span>Fotky <b>{job.photos.length}</b></span>
            {job.diagnostic && <span className="tag tag-accent" style={{ marginLeft: 'auto' }}>PDF diag.</span>}
          </div>
        </>
      )}
    </Link>
  )
}

function FinishedCard({ job, now }: { job: Job; now: number }) {
  const { state, mechName } = useWorkshop()
  const t = totalsOf(job, state.hourlyRate, now)
  return (
    <Blueprint className="card" style={{ padding: 14, gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="card-kicker">{skDateShort(job.date)} · #{job.id}</span>
        <StatusTag status={job.status} />
      </div>
      <div>
        <div className="card-title">{job.car.make} {job.car.model}</div>
        <div className="muted" style={{ fontSize: 12 }}>{job.customer.name} · {job.car.plate} · {mechName(job.mechanicId)}</div>
      </div>
      <div className="card-foot">
        <span>Čas <b>{hm(t.totalSec)}</b></span>
        <span>Diely <b>{eur(t.partsSum)}</b></span>
        <span>Spolu <b>{eur(t.grand)}</b></span>
        <Link to={`/report/${job.id}`} style={{ marginLeft: 'auto', fontSize: 13 }}>Report →</Link>
      </div>
    </Blueprint>
  )
}

function PeopleView({ now, today }: { now: number; today: string }) {
  const { state } = useWorkshop()
  return (
    <>
      {state.mechanics.map(m => {
        const jobs = state.jobs.filter(j => j.date === today && (j.timer.mechanicId === m.id || j.work.some(w => w.mechanicId === m.id)))
        const secOn = (j: Job) =>
          j.work.filter(w => w.mechanicId === m.id).reduce((a, w) => a + w.seconds, 0) + (j.timer.mechanicId === m.id ? elapsedOf(j, now) : 0)
        const total = jobs.reduce((a, j) => a + secOn(j), 0)
        const running = state.jobs.find(j => j.timer.running && j.timer.mechanicId === m.id)
        return (
          <Blueprint key={m.id} className="card" style={{ padding: 14, gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="card-title">{m.name}</span>
              {running
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-accent-700)' }}><i className="dot live" />beží · #{running.id}</span>
                : <span className="tag tag-neutral">voľno</span>}
            </div>
            <div className="card-foot" style={{ border: 0, padding: 0 }}>
              <span>Dnes <b>{hm(total)}</b></span>
              <span>Zákazky <b>{jobs.length}</b></span>
            </div>
            {jobs.map(j => (
              <Link key={j.id} to={`/zakazky/${j.id}`} className="job-row">
                <span>#{j.id} · {j.car.make} {j.car.model}</span>
                <span className="hd num">{hm(secOn(j))}</span>
              </Link>
            ))}
          </Blueprint>
        )
      })}
    </>
  )
}
