import type { OcrWord } from './partsScan'

/** The OCR engine, its worker and the Slovak model are served by the app itself (see vite.config.ts), never a CDN. */
const asset = (path: string) => `${location.origin}/tesseract/${path}`

/**
 * Words and their boxes in a screenshot, read on the device (the picture is never uploaded).
 * Sparse-text mode: a shop page is scattered text, and reading it as paragraphs garbles part numbers.
 */
export async function readWords(image: Blob, onProgress?: (share: number) => void): Promise<OcrWord[]> {
  const { createWorker, OEM, PSM } = await import('tesseract.js')
  const worker = await createWorker('slk', OEM.LSTM_ONLY, {
    workerPath: asset('worker.min.js'), corePath: asset('core'), langPath: asset('lang'),
    logger: m => { if (m.status === 'recognizing text') onProgress?.(m.progress) },
  })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
    const { data } = await worker.recognize(image, {}, { blocks: true })
    return (data.blocks ?? []).flatMap(b => b.paragraphs.flatMap(p => p.lines.flatMap(l =>
      l.words.map(w => ({ text: w.text, conf: w.confidence, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 })))))
  } finally {
    await worker.terminate()
  }
}
