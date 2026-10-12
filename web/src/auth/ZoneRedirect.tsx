import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'

/** "/" sends an owner on a wide screen to the desktop, everyone else to the phone app. */
export default function ZoneRedirect() {
  const { user } = useAuth()
  const wide = window.matchMedia('(min-width: 900px)').matches
  return <Navigate to={user?.role === 'owner' && wide ? '/admin' : '/m'} replace />
}
