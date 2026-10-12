import { useEffect } from 'react'

/** True when the app runs from the home screen (Android/Chrome or iOS Safari). */
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Sets the status-bar / browser-chrome colour while the component is mounted. */
export function useThemeColor(color: string) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) return
    const previous = meta.content
    meta.content = color
    return () => { meta.content = previous }
  }, [color])
}
