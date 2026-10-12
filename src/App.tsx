import { Navigate, Route, Routes } from 'react-router'
import TopBar from './components/TopBar'
import WorkshopToday from './screens/WorkshopToday'
import JobDetail from './screens/JobDetail'
import JobDiary from './screens/JobDiary'
import Dashboard from './screens/Dashboard'
import Report from './screens/Report'

export default function App() {
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/" element={<WorkshopToday />} />
        <Route path="/zakazky/:id" element={<JobDetail />} />
        <Route path="/zakazky/:id/dennik" element={<JobDiary />} />
        <Route path="/prehlad" element={<Dashboard />} />
        <Route path="/report/:id" element={<Report />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
