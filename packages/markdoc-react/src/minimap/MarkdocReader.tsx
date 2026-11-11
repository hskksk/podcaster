import * as React from 'react'
import { useCallback, useRef } from 'react'
import { MarkdocView, type MarkdocViewProps } from '../renderer/MarkdocView'
import { MarkdocTreemap, type MarkdocTreemapProps } from '../treemap/MarkdocTreemap'
import { MarkdocMinimap, type MarkdocMinimapProps } from './MarkdocMinimap'

export type MinimapVariant = 'treemap' | 'outline'

export interface MarkdocReaderProps extends MarkdocViewProps {
  showMinimap?: boolean
  /** `treemap` renders the tile + SVG link map from mem; `outline` is the lightweight list rail. */
  minimapVariant?: MinimapVariant
  treemap?: Omit<MarkdocTreemapProps, 'source' | 'scrollRoot' | 'onSelect'> & {
    onSelect?: MarkdocTreemapProps['onSelect']
  }
  minimap?: Omit<MarkdocMinimapProps, 'source' | 'scrollRoot'>
}

export function MarkdocReader({
  source,
  minimap,
  treemap,
  showMinimap = true,
  minimapVariant = 'treemap',
  className: viewClassName,
  ...viewProps
}: MarkdocReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToHeadingTitle = useCallback((title: string) => {
    const root = scrollRef.current
    if (!root) return
    const target = title.trim()
    for (const heading of root.querySelectorAll<HTMLElement>('.markdoc-heading')) {
      if (heading.textContent?.trim() === target) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
  }, [])

  const handleTreemapSelect = useCallback(
    (detail: { id: string; title: string; line?: number }) => {
      treemap?.onSelect?.(detail)
      scrollToHeadingTitle(detail.title)
    },
    [scrollToHeadingTitle, treemap],
  )

  return (
    <div className="markdoc-reader" data-minimap-variant={minimapVariant}>
      <div ref={scrollRef} className="markdoc-reader__main">
        <MarkdocView source={source} className={viewClassName} {...viewProps} />
      </div>
      {showMinimap && minimapVariant === 'treemap' ? (
        <MarkdocTreemap
          source={source}
          scrollRoot={scrollRef}
          mode="minimap"
          onSelect={handleTreemapSelect}
          {...treemap}
        />
      ) : null}
      {showMinimap && minimapVariant === 'outline' ? (
        <MarkdocMinimap source={source} scrollRoot={scrollRef} {...minimap} />
      ) : null}
    </div>
  )
}
