import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useMarkdocRuntime } from '../context/MarkdocProvider'
import type { ChartEngine, GraphEngine } from '../adapters/types'
import { childDiagramSource, toErrorMessage } from '../text'

type MountedKind = 'chart' | 'graph'

interface MountedVizProps {
  kind: MountedKind
  engine: string
  source?: string
  height?: string
  children?: ReactNode
}

function canvasStyle(height: string | undefined): CSSProperties | undefined {
  if (!height?.trim()) return undefined
  const value = height.trim()
  const normalized = /^\d+$/.test(value) ? `${value}px` : value
  return { height: normalized, minHeight: normalized }
}

export function MountedViz({ kind, engine, source, height, children }: MountedVizProps) {
  const { chartRenderer, graphRenderer, theme } = useMarkdocRuntime()
  const renderer = kind === 'chart' ? chartRenderer : graphRenderer
  const src = (source ?? childDiagramSource(children)).trim()
  const style = canvasStyle(height)
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    let cancelled = false
    let handle: { dispose: () => void; resize?: () => void } | undefined
    let resizeObserver: ResizeObserver | undefined

    setError(null)
    container?.replaceChildren()

    if (!container || !renderer || src.length === 0) return

    const mount =
      kind === 'chart'
        ? chartRenderer?.({ engine: engine as ChartEngine, source: src, theme, height }, container)
        : graphRenderer?.({ engine: engine as GraphEngine, source: src, theme, height }, container)

    if (!mount) return

    mount
      .then((result) => {
        if (cancelled) {
          result.handle?.dispose()
          return
        }
        if (result.error) {
          setError(result.error)
          return
        }
        handle = result.handle
        if (handle?.resize && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => handle?.resize?.())
          resizeObserver.observe(container)
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(toErrorMessage(cause))
      })

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      handle?.dispose()
      container?.replaceChildren()
    }
  }, [kind, engine, src, height, chartRenderer, graphRenderer, theme])

  const staticMessage =
    src.length === 0 ? `Empty ${kind}` : !renderer ? `No ${kind} renderer configured` : null

  const showFallback = Boolean(staticMessage || error)
  const className = `markdoc-${kind} markdoc-${kind}--${engine}${showFallback ? ` markdoc-${kind}--fallback` : ''}`

  return (
    <figure className={className} data-chart-engine={kind === 'chart' ? engine : undefined} data-graph-engine={kind === 'graph' ? engine : undefined}>
      <div ref={containerRef} className={`markdoc-${kind}__canvas`} style={style} />
      {showFallback && src.length > 0 && (
        <pre className={`markdoc-${kind}__source`}>
          <code>{src}</code>
        </pre>
      )}
      {(staticMessage || error) && (
        <figcaption className={`markdoc-${kind}__error`} role="alert">
          {staticMessage ?? error}
        </figcaption>
      )}
    </figure>
  )
}
