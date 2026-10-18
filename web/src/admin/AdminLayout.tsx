import { NavLink, Outlet } from 'react-router'
import { CalendarDays, FileText, LayoutGrid, ListChecks, LogOut, Settings, Smartphone, Users, Wrench } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useOrders, useSettings, useUsers } from '../data/queries'
import { firstName } from '../lib/calc'

/** Desktop shell for the owner: sidebar + page. */
export default function AdminLayout() {
  const { user, logout } = useAuth()
  const settings = useSettings()
  const users = useUsers()
  const orders = useOrders()
  const list = orders.data ?? []
  const brand = settings.data?.business.name ?? 'Dielňa'

  return (
    <div className="dash">
      <aside className="dash-side">
        <div className="hd" style={{ fontSize: 26, lineHeight: 1 }}>{brand}</div>
        <nav className="dash-nav" aria-label="Sekcie">
          <NavLink to="/admin" end><LayoutGrid size={16} strokeWidth={1.5} />Prehľad</NavLink>
          <NavLink to="/admin/zakazky"><Wrench size={16} strokeWidth={1.5} />Zákazky</NavLink>
          <NavLink to="/admin/kalendar"><CalendarDays size={16} strokeWidth={1.5} />Kalendár</NavLink>
          <NavLink to="/admin/reporty"><FileText size={16} strokeWidth={1.5} />Reporty</NavLink>
          <NavLink to="/admin/ukony"><ListChecks size={16} strokeWidth={1.5} />Úkony</NavLink>
          <NavLink to="/admin/tim"><Users size={16} strokeWidth={1.5} />Tím</NavLink>
          <NavLink to="/admin/nastavenia"><Settings size={16} strokeWidth={1.5} />Nastavenia</NavLink>
        </nav>
        <div className="dash-mechs">
          {(users.data ?? []).filter(u => u.is_active).map(m => {
            const running = list.some(o => o.work_entries.some(e => !e.ended_at && e.user.id === m.id))
            return (
              <div key={m.id}>
                <span>{firstName(m.name)}</span>
                <span style={running ? { color: 'var(--color-accent-700)' } : undefined}>{running ? '● beží' : 'voľno'}</span>
              </div>
            )
          })}
          <div style={{ marginTop: 10 }}>
            <span>{firstName(user?.name)}</span>
            <button type="button" className="linkbtn" onClick={() => void logout()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LogOut size={12} strokeWidth={1.5} />odhlásiť</button>
          </div>
          <div>
            <NavLink to="/m" style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Smartphone size={12} strokeWidth={1.5} />mobilná appka</NavLink>
          </div>
        </div>
      </aside>
      <main className="dash-main">
        <Outlet />
      </main>
    </div>
  )
}
