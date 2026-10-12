import { useCallback, useState } from 'react'
import { ApiError } from './api'

/** Runs one server action at a time and keeps its error for the screen to show. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : navigator.onLine ? 'Nepodarilo sa uložiť zmenu.' : 'Bez pripojenia. Zmena sa neuložila.')
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, error, run, clear: () => setError(null) }
}
