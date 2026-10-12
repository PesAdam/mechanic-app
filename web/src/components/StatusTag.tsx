import type { OrderStatus } from '../lib/types'

const LABELS: Record<OrderStatus, [string, string]> = {
  new: ['Prijatá', 'tag-neutral'],
  waiting: ['Diely objednané', 'tag-neutral'],
  open: ['Rozpracovaná', 'tag-accent'],
  unpaid: ['Čaká na platbu', 'tag-outline'],
  done: ['Uhradená', 'tag-neutral'],
}

export default function StatusTag({ status }: { status: OrderStatus }) {
  const [label, cls] = LABELS[status]
  return <span className={`tag ${cls}`}>{label}</span>
}
