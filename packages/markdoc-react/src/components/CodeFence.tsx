import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { HighlightResult } from '../adapters/types'
import { useMarkdocRuntime } from '../context/MarkdocProvider'
import { childText } from '../childText'

export function CodeFence({
  content,
  children,
  language,
  processed = false,
}: {
  content?: string
  children?: ReactNode
  language?: string
  processed?: boolean
}) {
  const code = (typeof content === 'string' ? content : childText(children)).replace(/\n$/, '')
  const { highlighter } = useMarkdocRuntime()

  const preview = useMemo(() => {
    if (processed || !highlighter) return null
    try {
      return highlighter({ code, language })
    } catch {
      return null
    }
  }, [processed, highlighter, code, language])

  const [asyncResult, setAsyncResult] = useState<{ token: Promise<HighlightResult>; result: HighlightResult | null } | null>(null)

  useEffect(() => {
    if (!(preview instanceof Promise)) return
    const token = preview
    let cancelled = false
    token
      .then((result) => {
        if (!cancelled) setAsyncResult({ token, result })
      })
      .catch(() => {
        if (!cancelled) setAsyncResult({ token, result: null })
      })
    return () => {
      cancelled = true
    }
  }, [preview])

  if (processed) {
    return <div className="markdoc-code markdoc-code--rich">{children}</div>
  }

  const highlighted = preview instanceof Promise
    ? (asyncResult?.token === preview ? asyncResult.result : null)
    : preview

  if (highlighted) {
    const className = ['markdoc-code', highlighted.className].filter(Boolean).join(' ')
    return (
      <pre className={className} style={highlighted.style as CSSProperties | undefined}>
        <code
          className={language ? `language-${language}` : undefined}
          dangerouslySetInnerHTML={{ __html: highlighted.html }}
        />
      </pre>
    )
  }

  return (
    <pre className="markdoc-code">
      <code className={language ? `language-${language}` : undefined}>{code}</code>
    </pre>
  )
}
