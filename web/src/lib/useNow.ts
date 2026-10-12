import { useEffect, useState } from 'react'

/** A clock that ticks once a second while `active`; otherwise a frozen `now`. */
export function useNow(active = true): number {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setT(Date.now())
    const id = setInterval(() => setT(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return t
}
