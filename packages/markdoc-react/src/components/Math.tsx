import { useEffect, useState, type ReactNode } from 'react'
import { useMarkdocRuntime } from '../context/MarkdocProvider'
import { childText } from '../childText'

export function Math({ display = true, children }: { display?: boolean; children?: ReactNode }) {
  const tex = childText(children).trim()
  const { mathRenderer } = useMarkdocRuntime()
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!mathRenderer) {
      setHtml(null)
      return
    }
    setHtml(null)
    Promise.resolve(mathRenderer({ tex, display }))
      .then((value) => {
        if (!cancelled) setHtml(value)
      })
      .catch(() => {
        if (!cancelled) setHtml(null)
      })
    return () => {
      cancelled = true
    }
  }, [tex, display, mathRenderer])

  const className = display ? 'markdoc-math markdoc-math--block' : 'markdoc-math markdoc-math--inline'

  if (html != null) {
    return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  }

  const fallback = display ? `\\[${tex}\\]` : `\\(${tex}\\)`
  return <span className={className}>{fallback}</span>
}
