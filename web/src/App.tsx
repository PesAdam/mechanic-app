import { Navigate, Route, Routes, useParams } from 'react-router'
import { RequireAuth, RequireOwner } from './auth/AuthContext'
import ZoneRedirect from './auth/ZoneRedirect'
import Login from './screens/Login'
import PublicReport from './screens/PublicReport'
import WorkshopToday from './mobile/WorkshopToday'
import JobDetail from './mobile/JobDetail'
import JobDiary from './mobile/JobDiary'
import Account from './mobile/Account'
import AdminLayout from './admin/AdminLayout'
import Dashboard from './admin/Dashboard'
import Orders from './admin/Orders'
import OrderDetail from './admin/OrderDetail'
import Reports from './admin/Reports'
import ReportPage from './admin/ReportPage'
import TeamPage from './admin/TeamPage'
import SettingsPage from './admin/SettingsPage'
import OperationsPage from './admin/OperationsPage'
import CalendarPage from './admin/CalendarPage'

/** Old URLs from before the mobile/admin split keep working (installed PWAs may still hold them). */
function Legacy({ to }: { to: string }) {
  const params = useParams()
  return <Navigate to={to.replace(/:(\w+)/g, (_, k: string) => params[k] ?? '')} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/r/:token" element={<PublicReport />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<ZoneRedirect />} />

        {/* Mobilná zóna: dielňa pre mechanikov */}
        <Route path="/m" element={<WorkshopToday />} />
        <Route path="/m/zakazky/:id" element={<JobDetail />} />
        <Route path="/m/zakazky/:id/dennik" element={<JobDiary />} />
        <Route path="/m/ucet" element={<Account />} />

        {/* Desktopová zóna: majiteľ */}
        <Route path="/admin" element={<RequireOwner><AdminLayout /></RequireOwner>}>
          <Route index element={<Dashboard />} />
          <Route path="zakazky" element={<Orders />} />
          <Route path="zakazky/:id" element={<OrderDetail />} />
          <Route path="kalendar" element={<CalendarPage />} />
          <Route path="reporty" element={<Reports />} />
          <Route path="reporty/:id" element={<ReportPage />} />
          <Route path="tim" element={<TeamPage />} />
          <Route path="ukony" element={<OperationsPage />} />
          <Route path="nastavenia" element={<SettingsPage />} />
        </Route>

        <Route path="/zakazky/:id" element={<Legacy to="/m/zakazky/:id" />} />
        <Route path="/zakazky/:id/dennik" element={<Legacy to="/m/zakazky/:id/dennik" />} />
        <Route path="/prehlad" element={<Navigate to="/admin" replace />} />
        <Route path="/tim" element={<Navigate to="/admin/tim" replace />} />
        <Route path="/report/:id" element={<Legacy to="/admin/reporty/:id" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
