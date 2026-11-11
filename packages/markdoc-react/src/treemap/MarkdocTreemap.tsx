import * as React from 'react'
import { useEffect, useRef } from 'react'
import { mountTreemap } from './legacyMount'
import type { mockTreemapAi } from './mockAi'

export type TreemapMode = 'minimap' | 'full'
export type TreemapTheme = 'auto' | 'light' | 'dark'

export interface MarkdocTreemapProps {
  source: string
  mode?: TreemapMode
  theme?: TreemapTheme
  className?: string
  designWidth?: number
  ai?: typeof mockTreemapAi
  /** When the rendered document scrolls, highlight the matching treemap tile. */
  scrollRoot?: React.RefObject<HTMLElement | null>
  onSelect?: (detail: { id: string; title: string; line?: number }) => void
  onAiState?: (state: { pending: number; error?: string }) => void
}

function lineForHeadingTitle(source: string, title: string): number {
  const lines = source.split('\n')
  const target = title.trim()
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#{1,6}\s+(.*)$/)
    if (m && m[1].trim() === target) return i
  }
  return -1
}

export function MarkdocTreemap({
  source,
  mode = 'minimap',
  theme = 'auto',
  className,
  designWidth = 760,
  ai,
  scrollRoot,
  onSelect,
  onAiState,
}: MarkdocTreemapProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<ReturnType<typeof mountTreemap> | null>(null)
  const onSelectRef = useRef(onSelect)
  const onAiStateRef = useRef(onAiState)
  onSelectRef.current = onSelect
  onAiStateRef.current = onAiState

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const controller = mountTreemap(host, {
      mode,
      theme,
      designWidth,
      ai,
      onSelect: (detail: { id: string; title: string; line?: number }) => onSelectRef.current?.(detail),
      onAiState: (state: { pending: number; error?: string }) => onAiStateRef.current?.(state),
      followActive: true,
    })
    controllerRef.current = controller
    controller.update(source)

    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [ai, designWidth, mode, theme])

  useEffect(() => {
    controllerRef.current?.update(source)
  }, [source])

  useEffect(() => {
    const root = scrollRoot?.current
    const controller = controllerRef.current
    if (!root || !controller || typeof IntersectionObserver === 'undefined') return

    const headings = root.querySelectorAll<HTMLElement>('.markdoc-heading')
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const el = visible?.target as HTMLElement | undefined
        if (!el?.textContent) return
        const line = lineForHeadingTitle(source, el.textContent.trim())
        if (line >= 0) controller.setActiveLine(line)
      },
      { root, rootMargin: '-15% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] },
    )

    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [scrollRoot, source])

  const hostClass = className ? `markdoc-treemap-host ${className}` : 'markdoc-treemap-host'

  return <div ref={hostRef} className={hostClass} data-treemap-mode={mode} />
}
