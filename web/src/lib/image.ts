/** Downscale a picked photo to a JPEG blob before upload. */
export function resizeImage(file: File, max = 1600, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) return reject(new Error('canvas unavailable'))
      ctx.drawImage(img, 0, 0, w, h)
      c.toBlob(blob => (blob ? resolve(blob) : reject(new Error('encode failed'))), 'image/jpeg', quality)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image failed to load'))
    }
    img.src = url
  })
}

/** Downscale every picked photo, skipping files that cannot be read. */
export async function resizeImages(files: FileList | null): Promise<Blob[]> {
  const out: Blob[] = []
  for (const f of Array.from(files ?? [])) {
    try { out.push(await resizeImage(f)) } catch { /* unreadable file */ }
  }
  return out
}
