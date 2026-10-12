import type { Order } from './types'

export const publicReportUrl = (token: string) => `${window.location.origin}/r/${token}`

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

/** Native share sheet on phones, clipboard elsewhere. */
export async function shareReport(order: Order): Promise<'shared' | 'copied' | 'failed'> {
  const url = publicReportUrl(order.public_token)
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `Servisný report #${order.number}`, text: `${order.car.make} ${order.car.model} · ${order.car.plate}`, url })
      return 'shared'
    } catch {
      return 'failed'
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed'
}
