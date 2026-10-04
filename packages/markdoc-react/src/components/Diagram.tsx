import { useEffect, useState, type ReactNode } from 'react'
import { useMarkdocRuntime } from '../context/MarkdocProvider'
import { childDiagramSource, toErrorMessage } from '../text'

export function Diagram({ type = 'mermaid', source, children }: { type?: string; source?: string; children?: ReactNode }) {
  const kind = type === 'd2' ? 'd2' : 'mermaid'
  const src = (source ?? childDiagramSource(children)).trim()
  const { diagramRenderer, theme } = useMarkdocRuntime()
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setError(null)

    if (!diagramRenderer || src.length === 0) return

    diagramRenderer({ type: kind, source: src, theme })
      .then((result) => {
        if (cancelled) return
        if (result.svg) {
          setSvg(result.svg)
        } else {
          setError(result.error ?? 'Unable to render diagram')
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(toErrorMessage(cause))
      })

    return () => {
      cancelled = true
    }
  }, [src, kind, diagramRenderer, theme])

  if (svg) {
    return (
      <figure className={`markdoc-diagram markdoc-diagram--${kind}`} data-diagram-type={kind}>
        <div className="markdoc-diagram__canvas" dangerouslySetInnerHTML={{ __html: svg }} />
      </figure>
    )
  }

  const message = src.length === 0
    ? 'Empty diagram'
    : !diagramRenderer
      ? 'No diagram renderer configured'
      : error

  return (
    <figure className={`markdoc-diagram markdoc-diagram--${kind} markdoc-diagram--fallback`} data-diagram-type={kind}>
      {src.length > 0 && (
        <pre className="markdoc-diagram__source">
          <code>{src}</code>
        </pre>
      )}
      {message && <figcaption className="markdoc-diagram__error" role="alert">{message}</figcaption>}
    </figure>
  )
}
