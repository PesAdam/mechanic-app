import { useCallback, useSyncExternalStore } from 'react'

/** True while the viewport matches `query`; false where matchMedia is missing (tests, SSR). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const list = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
    if (!list?.addEventListener) return () => {}
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  const read = () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false)
  return useSyncExternalStore(subscribe, read, () => false)
}

/** The admin zone turns into its phone layout here (keep in step with app.css). */
export const PHONE = '(max-width: 760px)'
