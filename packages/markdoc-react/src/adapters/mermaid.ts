import { toErrorMessage } from '../text'
import type { DiagramRenderer, DiagramTheme } from './types'

export interface MermaidRenderResult {
  svg: string
  bindFunctions?: (element: Element) => void
}

export interface MermaidLike {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, text: string) => Promise<MermaidRenderResult>
}

let renderCount = 0

function mermaidTheme(theme: DiagramTheme | undefined): string {
  return theme === 'dark' ? 'dark' : 'default'
}

export function createMermaidRenderer(mermaid: MermaidLike): DiagramRenderer {
  let appliedTheme: string | undefined

  return async ({ source, theme }) => {
    try {
      const nextTheme = mermaidTheme(theme)
      if (appliedTheme !== nextTheme) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: nextTheme,
        })
        appliedTheme = nextTheme
      }
      renderCount += 1
      const result = await mermaid.render(`markdoc-diagram-${renderCount}`, source)
      return { svg: result.svg }
    } catch (error) {
      return { error: toErrorMessage(error) }
    }
  }
}
