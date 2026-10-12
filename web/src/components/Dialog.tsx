import { useEffect, type ReactNode } from 'react'
import { Corners } from './Blueprint'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
}

export default function Dialog({ open, title, onClose, children, actions }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="dialog-backdrop" style={{ zIndex: 100 }} onClick={onClose}>
      <div className="dialog blueprint" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <Corners />
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  )
}
