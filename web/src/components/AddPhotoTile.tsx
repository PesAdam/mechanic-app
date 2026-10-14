import { useRef } from 'react'
import { Camera } from 'lucide-react'
import Blueprint from './Blueprint'
import { resizeImages } from '../lib/image'

/** Picks one or more photos at once. */
export default function AddPhotoTile({ onPick }: { onPick: (blobs: Blob[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <Blueprint as="button" className="add-tile" onClick={() => input.current?.click()}>
      <Camera size={26} strokeWidth={1.5} aria-label="Pridať fotku" />
      <input ref={input} type="file" accept="image/*" multiple hidden
        onChange={async e => { const files = e.target.files; const blobs = await resizeImages(files); e.target.value = ''; if (blobs.length) onPick(blobs) }} />
    </Blueprint>
  )
}
