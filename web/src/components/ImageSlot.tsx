import { useRef, type CSSProperties } from 'react'
import { Corners } from './Blueprint'
import { resizeImage } from '../lib/image'

interface Props {
  src?: string | null
  label: string
  style?: CSSProperties
  className?: string
  /** When given, the slot is a button that opens the camera / file picker. */
  onPick?: (blob: Blob) => void
}

/** A duotoned, blueprint-framed photo slot. Empty slots show their label. */
export default function ImageSlot({ src, label, style, className = '', onPick }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const clickable = !!onPick
  const open = () => input.current?.click()
  return (
    <div
      className={`blueprint duotone img-slot ${className}`.trim()}
      style={style}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${label} – vybrať fotku` : undefined}
      onClick={clickable ? open : undefined}
      onKeyDown={clickable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } } : undefined}
    >
      <Corners />
      {src ? <img src={src} alt={label} loading="lazy" /> : <span className="img-slot-label">{label}</span>}
      {clickable && (
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
