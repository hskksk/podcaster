import type { ReactNode } from 'react'

export function Details({ summary, open = false, children }: { summary?: string; open?: boolean; children?: ReactNode }) {
  return (
    <details className="markdoc-details" open={Boolean(open)}>
      <summary className="markdoc-details__summary">{summary ?? 'Details'}</summary>
      <div className="markdoc-details__body">{children}</div>
    </details>
  )
}
