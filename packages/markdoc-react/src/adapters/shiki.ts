import type { CSSProperties } from 'react'
import { escapeHtml } from '../text'
import type { HighlightResult, Highlighter } from './types'

export interface ShikiHighlighterLike {
  codeToHtml: (code: string, options: { lang: string; theme: string }) => Promise<string>
}

export interface ShikiRendererOptions {
  theme?: string
}

function attribute(source: string, name: string): string | undefined {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`))
  return match?.[2] ?? match?.[3]
}

function cssStyleToReact(style: string | undefined): CSSProperties | undefined {
  if (!style) return undefined
  const result: Record<string, string> = {}
  for (const declaration of style.split(';')) {
    const index = declaration.indexOf(':')
    if (index === -1) continue
    const property = declaration.slice(0, index).trim()
    const value = declaration.slice(index + 1).trim()
    if (!property || !value) continue
    const key = property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
    result[key] = value
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/** Shiki returns a full `<pre><code>`. Keep the inner HTML and lift the pre's class and style. */
export function splitShikiBlock(html: string, code: string): HighlightResult {
  const pre = html.trim().match(/^<pre\b([^>]*)>([\s\S]*)<\/pre>$/)
  if (!pre) return { html: escapeHtml(code) }
  const inner = pre[2].match(/^\s*<code\b[^>]*>([\s\S]*)<\/code>\s*$/)
  return {
    html: inner?.[1] ?? escapeHtml(code),
    className: attribute(pre[1], 'class'),
    style: cssStyleToReact(attribute(pre[1], 'style')),
  }
}

export function createShikiRenderer(highlighter: ShikiHighlighterLike, options: ShikiRendererOptions = {}): Highlighter {
  const theme = options.theme ?? 'github-dark'

  return async ({ code, language }) => {
    try {
      const html = await highlighter.codeToHtml(code, { lang: language || 'text', theme })
      return splitShikiBlock(html, code)
    } catch {
      return { html: escapeHtml(code) }
    }
  }
}
