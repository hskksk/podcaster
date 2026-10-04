import { createElement, type ReactNode } from 'react'

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

function clampLevel(level: number | undefined): number {
  const value = Number(level)
  if (!Number.isFinite(value)) return 1
  return Math.min(6, Math.max(1, Math.trunc(value)))
}

export function Heading({ level, id, children }: { level?: number; id?: string; children?: ReactNode }) {
  const tag = `h${clampLevel(level)}` as HeadingTag
  return createElement(tag, { ...(id ? { id } : {}), className: 'markdoc-heading' }, children)
}
