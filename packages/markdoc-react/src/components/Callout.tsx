import type { ReactNode } from 'react'

export type CalloutType = 'note' | 'tip' | 'warning' | 'error'

const CALLOUT_TYPES: CalloutType[] = ['note', 'tip', 'warning', 'error']

function CalloutIcon({ type }: { type: CalloutType }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (type === 'warning') {
    return (
      <svg {...common}>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    )
  }

  if (type === 'error') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
      </svg>
    )
  }

  if (type === 'tip') {
    return (
      <svg {...common}>
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

export function Callout({ type = 'note', children }: { type?: string; children?: ReactNode }) {
  const kind: CalloutType = CALLOUT_TYPES.includes(type as CalloutType) ? (type as CalloutType) : 'note'

  return (
    <aside className={`markdoc-callout markdoc-callout--${kind}`} data-callout-type={kind}>
      <span className="markdoc-callout__icon">
        <CalloutIcon type={kind} />
      </span>
      <div className="markdoc-callout__body">{children}</div>
    </aside>
  )
}
