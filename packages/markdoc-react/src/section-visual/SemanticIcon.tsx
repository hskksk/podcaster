import type { ReactElement } from 'react'

const ICONS: Record<string, ReactElement> = {
  person: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20c.7-3.5 3-5.5 6.5-5.5s5.8 2 6.5 5.5" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 4h8l4 4v12H8z" />
      <path d="M16 4v4h4M10 12h6M10 16h4" />
    </svg>
  ),
  database: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3 5 6v6c0 5 3.4 8.5 7 9 3.6-.5 7-4 7-9V6l-7-3z" />
    </svg>
  ),
  timer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5M9 3h6" />
    </svg>
  ),
  workspace: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  ),
  service: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 7h16v10H4zM8 7V5h8v2" />
      <circle cx="8" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7.5 7.5 10.5 16M16.5 7.5 13.5 16M8 6h8" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M5 19V9M10 19V5M15 19v-7M20 19v-11" />
    </svg>
  ),
}

export function SemanticIcon({ id }: { id?: string }) {
  if (!id) return null
  return (
    <span className="article-visual__icon" aria-hidden data-icon={id}>
      {ICONS[id] ?? (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="4" />
        </svg>
      )}
    </span>
  )
}
