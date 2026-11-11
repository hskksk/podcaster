import type { ReactNode } from 'react'

const BADGE_TYPES = new Set(['default', 'info', 'success', 'warning', 'danger'])

export function Badge({ type = 'default', children }: { type?: string; children?: ReactNode }) {
  const kind = BADGE_TYPES.has(type) ? type : 'default'
  return (
    <span className={`markdoc-badge markdoc-badge--${kind}`} data-badge-type={kind}>
      {children}
    </span>
  )
}
