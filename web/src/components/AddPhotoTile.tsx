import { useRef } from 'react'
import { Camera } from 'lucide-react'
import Blueprint from './Blueprint'
import { resizeImage } from '../lib/image'

export default function AddPhotoTile({ onPick }: { onPick: (blob: Blob) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <Blueprint as="button" className="add-tile" onClick={() => input.current?.click()}>
      <Camera size={26} strokeWidth={1.5} aria-label="Pridať fotku" />
      <input ref={input} type="file" accept="image/*" hidden
        onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { try { onPick(await resizeImage(f)) } catch { /* ignore unreadable file */ } } }} />
    </Blueprint>
  )
}
