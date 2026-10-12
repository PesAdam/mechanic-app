import type { CSSProperties, ElementType, MouseEventHandler, ReactNode } from 'react'

/** The four "+" registration marks every Industry frame wears. */
export function Corners() {
  return (
    <>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
    </>
  )
}

interface Props {
  as?: ElementType
  className?: string
  style?: CSSProperties
  children?: ReactNode
  onClick?: MouseEventHandler
  role?: string
  'aria-label'?: string
}

export default function Blueprint({ as, className = '', style, children, onClick, role, 'aria-label': ariaLabel }: Props) {
  const Tag: ElementType = as ?? 'div'
  return (
    <Tag className={`blueprint ${className}`.trim()} style={style} onClick={onClick} role={role} aria-label={ariaLabel}>
      <Corners />
      {children}
    </Tag>
  )
}
