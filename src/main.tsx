import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { registerSW } from 'virtual:pwa-register'
import './styles/industry.css'
import './styles/app.css'
import App from './App'
import { WorkshopProvider } from './store/workshop'

// Service worker: precaches the build and the fonts so the app opens offline.
// With `autoUpdate` a new deploy activates on the next load.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WorkshopProvider>
        <App />
      </WorkshopProvider>
    </BrowserRouter>
  </StrictMode>,
)
