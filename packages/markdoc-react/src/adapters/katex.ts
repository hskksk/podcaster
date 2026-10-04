import type { MathRenderer } from './types'

export interface KatexLike {
  renderToString: (tex: string, options?: Record<string, unknown>) => string
}

export function createKatexRenderer(katex: KatexLike, options: Record<string, unknown> = {}): MathRenderer {
  return ({ tex, display }) => {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, ...options })
    } catch {
      return display ? `\\[${tex}\\]` : `\\(${tex}\\)`
    }
  }
}
