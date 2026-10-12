import { eur, hm } from '../lib/format'

interface Props { seconds: number; normSeconds: number; rate: number; size?: number }

/** "+25 min · +11,67 €" in green while under the norm, red once over it. */
export default function NormBadge({ seconds, normSeconds, rate, size = 12 }: Props) {
  if (!normSeconds) return null
  const delta = normSeconds - seconds
  const ok = delta >= 0
  const abs = Math.abs(delta)
  return (
    <span className={ok ? 'norm-ok' : 'norm-bad'} style={{ fontSize: size, fontWeight: 500, whiteSpace: 'nowrap' }}>
      {ok ? '+' : '−'}{hm(abs)} · {ok ? '+' : '−'}{eur((abs / 3600) * rate)}
    </span>
  )
}
