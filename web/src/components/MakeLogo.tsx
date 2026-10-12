import { useState } from 'react'

/** Brand badge: the logo when it loads, a monogram otherwise. */
/** `decorative` when the name is printed right next to it, so screen readers don't say it twice. */
export default function MakeLogo({ name, url, size = 40, decorative = false }: { name: string; url?: string | null; size?: number; decorative?: boolean }) {
  const [broken, setBroken] = useState(false)
  if (url && !broken) {
    return <img src={url} alt={decorative ? '' : name} width={size} height={size} loading="lazy" style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} onError={() => setBroken(true)} />
  }
  const initials = name.split(/[\s-]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="hd" aria-hidden="true" style={{ width: size, height: size, display: 'grid', placeItems: 'center', border: '1px solid var(--color-divider)', fontSize: Math.round(size * 0.4), color: 'var(--color-accent-700)' }}>{initials}</span>
  )
}
