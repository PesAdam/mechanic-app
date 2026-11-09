import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Shot { url: string | null; label: string }
interface Props { photos: Shot[]; index: number; onClose: () => void; onIndex: (index: number) => void }

/** One report photo on the whole screen; the arrows, a swipe or the keyboard step through the rest, Esc or a tap outside closes. */
export default function PhotoViewer({ photos, index, onClose, onIndex }: Props) {
  const touchX = useRef<number | null>(null)
  const count = photos.length

  useEffect(() => {
    const go = (d: number) => onIndex((index + d + count) % count)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && count > 1) go(1)
      else if (e.key === 'ArrowLeft' && count > 1) go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, count, onClose, onIndex])

  // The page behind must not scroll while the photo is up.
  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [])

  const shot = photos[index]
  if (!shot) return null
  const step = (d: number) => onIndex((index + d + count) % count)

  return (
    <div className="lightbox no-print" role="dialog" aria-modal="true" aria-label={shot.label} onClick={onClose}
      onTouchStart={e => { touchX.current = e.touches[0]?.clientX ?? null }}
      onTouchEnd={e => {
        const from = touchX.current
        const to = e.changedTouches[0]?.clientX
        touchX.current = null
        if (from !== null && to !== undefined && Math.abs(to - from) > 40 && count > 1) step(to < from ? 1 : -1)
      }}>
      <img src={shot.url ?? undefined} alt={shot.label} onClick={e => e.stopPropagation()} />
      <div className="lightbox-bar" onClick={e => e.stopPropagation()}>
        <span>{shot.label}{count > 1 ? ` · ${index + 1} / ${count}` : ''}</span>
        <button type="button" className="btn btn-icon lightbox-btn" aria-label="Zavrieť" onClick={onClose}><X size={20} strokeWidth={1.5} /></button>
      </div>
      {count > 1 && (
        <>
          <button type="button" className="btn btn-icon lightbox-btn lightbox-prev" aria-label="Predchádzajúca fotka" onClick={e => { e.stopPropagation(); step(-1) }}><ChevronLeft size={22} strokeWidth={1.5} /></button>
          <button type="button" className="btn btn-icon lightbox-btn lightbox-next" aria-label="Nasledujúca fotka" onClick={e => { e.stopPropagation(); step(1) }}><ChevronRight size={22} strokeWidth={1.5} /></button>
        </>
      )}
    </div>
  )
}
