import { useRef, type CSSProperties } from 'react'
import { X } from 'lucide-react'
import { Corners } from './Blueprint'
import { resizeImage } from '../lib/image'

interface Props {
  src?: string | null
  label: string
  style?: CSSProperties
  className?: string
  /** When given, the slot is a button that opens the camera / file picker. */
  onPick?: (blob: Blob) => void
  /** When given, a small × in the corner removes the photo. */
  onRemove?: () => void
  /** When given (and there is a photo), tapping the slot opens it full size instead of picking a file. */
  onOpen?: () => void
}

/** A blueprint-framed photo slot. Empty slots show their label. */
export default function ImageSlot({ src, label, style, className = '', onPick, onRemove, onOpen }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const views = !!src && !!onOpen && !onPick
  const clickable = !!onPick || views
  const open = () => (views ? onOpen?.() : input.current?.click())
  return (
    <div
      className={`blueprint img-slot ${className}`.trim()}
      style={style}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${label} – ${views ? 'zväčšiť' : 'vybrať fotku'}` : undefined}
      onClick={clickable ? open : undefined}
      onKeyDown={clickable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } } : undefined}
    >
      <Corners />
      {src ? <img src={src} alt={label} loading="lazy" /> : <span className="img-slot-label">{label}</span>}
      {onRemove && (
        <button type="button" className="img-slot-remove" aria-label={`${label} – zmazať fotku`}
          onClick={e => { e.stopPropagation(); onRemove() }}
          onKeyDown={e => e.stopPropagation()}>
          <X size={14} strokeWidth={2} />
        </button>
      )}
      {onPick && (
        <input
          ref={input} type="file" accept="image/*" hidden
          onChange={async e => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f && onPick) {
              try { onPick(await resizeImage(f)) } catch { /* unreadable file: leave the slot as it was */ }
            }
          }}
        />
      )}
    </div>
  )
}
