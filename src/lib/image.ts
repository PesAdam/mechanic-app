/** Downscale a picked image to a JPEG data URL so a handful of photos fit in
 *  localStorage. Returns the data URL. */
export function fileToDataUrl(file: File, max = 1200, quality = 0.82): Promise<string> {
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
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image failed to load'))
    }
    img.src = url
  })
}
