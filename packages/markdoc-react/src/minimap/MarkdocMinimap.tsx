import * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { extractMinimapOutline } from './extractOutline'
import type { MinimapLabeler, MinimapSection } from './types'

export interface MarkdocMinimapProps {
  source: string
  /** Scrollable element that wraps {@link MarkdocView}. Defaults to the nearest `.markdoc-reader__main`. */
  scrollRoot?: React.RefObject<HTMLElement | null>
  className?: string
  /** Optional async labeler (use {@link createMockMinimapLabeler} for local demos). */
  labeler?: MinimapLabeler
  onSectionClick?: (section: MinimapSection) => void
}

function segmentFlex(weight: number, total: number): number {
  if (total <= 0) return 1
  return Math.max(0.35, weight / total)
}

export function MarkdocMinimap({ source, scrollRoot, className, labeler, onSectionClick }: MarkdocMinimapProps) {
  const outline = useMemo(() => extractMinimapOutline(source), [source])
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string | null>(outline.sections[0]?.id ?? null)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!labeler) {
      setLabels({})
      return
    }
    let cancelled = false
    void (async () => {
      const next: Record<string, string> = {}
      for (const section of outline.sections) {
        if (cancelled) return
        next[section.id] = await labeler(section)
      }
      if (!cancelled) setLabels(next)
    })()
    return () => {
      cancelled = true
    }
  }, [labeler, outline.sections])

  const resolveScrollRoot = useCallback((): HTMLElement | null => {
    if (scrollRoot?.current) return scrollRoot.current
    const host = navRef.current?.closest('.markdoc-reader')
    return host?.querySelector<HTMLElement>('.markdoc-reader__main') ?? null
  }, [scrollRoot])

  useEffect(() => {
    const root = resolveScrollRoot()
    if (!root) return

    const headings = outline.sections
      .map((section) => {
        const el = root.querySelector<HTMLElement>(`#${CSS.escape(section.id)}`)
        return el ? { id: section.id, el } : null
      })
      .filter((entry): entry is { id: string; el: HTMLElement } => entry != null)

    if (headings.length === 0 || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) setActiveId(visible[0].target.id)
      },
      { root, rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.1, 0.25, 0.5, 1] },
    )

    for (const { el } of headings) observer.observe(el)
    return () => observer.disconnect()
  }, [outline.sections, resolveScrollRoot, source])

  const jumpTo = useCallback(
    (section: MinimapSection) => {
      onSectionClick?.(section)
      const root = resolveScrollRoot()
      const target = root?.querySelector<HTMLElement>(`#${CSS.escape(section.id)}`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(section.id)
    },
    [onSectionClick, resolveScrollRoot],
  )

  const total = outline.totalWeight

  return (
    <nav
      ref={navRef}
      className={className ? `markdoc-minimap ${className}` : 'markdoc-minimap'}
      aria-label="Document map"
    >
      <ol className="markdoc-minimap__track">
        {outline.sections.map((section) => {
          const label = labels[section.id] ?? section.title
          const isActive = section.id === activeId
          return (
            <li
              key={section.id}
              className="markdoc-minimap__segment"
              style={{ flexGrow: segmentFlex(section.weight, total) }}
              data-level={section.level}
              data-active={isActive ? '' : undefined}
            >
              <button
                type="button"
                className="markdoc-minimap__button"
                title={label}
                aria-current={isActive ? 'location' : undefined}
                onClick={() => jumpTo(section)}
              >
                <span className="markdoc-minimap__bar" aria-hidden="true" />
                <span className="markdoc-minimap__label">{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
