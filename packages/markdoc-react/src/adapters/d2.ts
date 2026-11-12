import { toErrorMessage } from '../text'
import type { DiagramRenderer } from './types'

export interface D2CompileResult {
  diagram: unknown
  renderOptions: Record<string, unknown>
}

export interface D2Like {
  compile: (source: string) => Promise<D2CompileResult>
  render: (diagram: unknown, options: Record<string, unknown>) => Promise<string>
}

let renderCount = 0

export function createD2Renderer(d2: D2Like): DiagramRenderer {
  return async ({ source }) => {
    try {
      renderCount += 1
      const compiled = await d2.compile(source)
      const svg = await d2.render(compiled.diagram, {
        ...compiled.renderOptions,
        noXMLTag: true,
        salt: `markdoc-diagram-${renderCount}`,
      })
      return { svg }
    } catch (error) {
      return { error: toErrorMessage(error) }
    }
  }
}
