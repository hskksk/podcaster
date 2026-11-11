import { escapeHtml } from '../text'
import type { Highlighter } from './types'

export interface HighlightJsLike {
  getLanguage?: (name: string) => unknown
  highlight: (code: string, options: { language: string; ignoreIllegals?: boolean }) => { value: string }
}

export function createHighlightJsRenderer(hljs: HighlightJsLike): Highlighter {
  return ({ code, language }) => {
    const supported = language != null && (hljs.getLanguage == null || Boolean(hljs.getLanguage(language)))
    if (supported) {
      return { html: hljs.highlight(code, { language: language as string, ignoreIllegals: true }).value }
    }
    return { html: escapeHtml(code) }
  }
}
