import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { registerSW } from 'virtual:pwa-register'
import './styles/industry.css'
import './styles/app.css'
import App from './App'
import { AuthProvider } from './auth/AuthContext'

// Service worker: precaches the build and the fonts so the shell opens offline.
registerSW({ immediate: true })

const DAY = 24 * 60 * 60 * 1000

// Server data lives in react-query; the cache is mirrored to localStorage so the
// last known board shows up offline and the app opens without a spinner.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, gcTime: 7 * DAY, retry: 1, networkMode: 'offlineFirst' },
    mutations: { networkMode: 'offlineFirst' },
  },
})

const safeStorage = {
  getItem: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* quota or private mode */ } },
  removeItem: (k: string) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}
const persister = createSyncStoragePersister({ storage: safeStorage, key: 'mechanic-app:query-cache' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 7 * DAY, buster: 'v5' }}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)
