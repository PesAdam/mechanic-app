import Blueprint from './Blueprint'

export function Loading({ text = 'Načítavam…' }: { text?: string }) {
  return (
    <div className="phone">
      <div className="screen">
        <Blueprint style={{ padding: 16 }}><div className="muted" style={{ fontSize: 13 }}>{text}</div></Blueprint>
      </div>
    </div>
  )
}

export function LoadError({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <Blueprint style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13 }}>{text}</div>
      {onRetry && <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onRetry}>Skúsiť znova</button>}
    </Blueprint>
  )
}
