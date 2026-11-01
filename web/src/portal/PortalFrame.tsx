import type { ReactNode } from 'react'

/** The portal's page: one column, wider than the workshop phone screens because people also use it on a computer. */
export default function PortalFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone" style={{ maxWidth: 560 }}>
      <div className="screen">{children}</div>
    </div>
  )
}
