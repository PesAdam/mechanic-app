import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import Blueprint, { Corners } from './Blueprint'
import { isIOS, isStandalone } from '../lib/pwa'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'mechanic-app:install-dismissed'

/** "Pridať na plochu": the native install prompt on Android/Chrome, a
 *  Share → Add to Home Screen hint on iOS. Hidden once installed or dismissed. */
export default function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === '1' } catch { return false }
  })
  const [standalone] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setPrompt(null); setHidden(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (hidden || standalone) return null
  // Safari never fires beforeinstallprompt, so iOS gets the manual hint;
  // anywhere the native prompt exists it wins.
  const ios = !prompt && isIOS()
  if (!prompt && !ios) return null

  const dismiss = () => {
    setHidden(true)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch { /* ignore */ }
  }
  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    setPrompt(null)
    if (outcome === 'accepted') dismiss()
  }

  return (
    <Blueprint className="install" role="region" aria-label="Pridať na plochu">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="card-kicker">Mobilná appka</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Pridať Dielňu na plochu</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {ios
            ? <>V Safari ťuknite na <Share size={12} strokeWidth={1.5} style={{ display: 'inline', verticalAlign: '-2px' }} /> Zdieľať a potom „Pridať na plochu“.</>
            : 'Otvorí sa na celú obrazovku a funguje aj bez signálu.'}
        </div>
      </div>
      {prompt && (
        <button className="btn btn-primary blueprint" style={{ minHeight: 40 }} onClick={install}>
          <Corners /><Download size={16} strokeWidth={1.5} />Nainštalovať
        </button>
      )}
      <button className="btn btn-ghost btn-icon" aria-label="Zavrieť" onClick={dismiss}><X size={16} strokeWidth={1.5} /></button>
    </Blueprint>
  )
}
