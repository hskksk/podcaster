import { toErrorMessage } from '../text'
import type {
  ChartEngine,
  ChartHandler,
  ChartRenderer,
  GraphEngine,
  GraphHandler,
  GraphRenderer,
  VizHandlerContext,
  VizMountResult,
} from './types'

async function mountWithHandler<E extends string>(
  handlers: Partial<Record<E, ChartHandler | GraphHandler>>,
  engine: E,
  engineLabel: string,
  container: HTMLElement,
  source: string,
  context: VizHandlerContext,
): Promise<VizMountResult> {
  const handler = handlers[engine]
  if (!handler) {
    return { error: `No ${engineLabel} handler configured for engine "${engine}"` }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch (cause) {
    return { error: `Invalid JSON: ${toErrorMessage(cause)}` }
  }

  try {
    const handle = await handler(container, parsed, context)
    return { handle }
  } catch (cause) {
    return { error: toErrorMessage(cause) }
  }
}

export function createChartRenderer(handlers: Partial<Record<ChartEngine, ChartHandler>>): ChartRenderer {
  return (input, container) =>
    mountWithHandler(handlers, input.engine, 'chart', container, input.source, {
      theme: input.theme,
      height: input.height,
    })
}

export function createGraphRenderer(handlers: Partial<Record<GraphEngine, GraphHandler>>): GraphRenderer {
  return (input, container) =>
    mountWithHandler(handlers, input.engine, 'graph', container, input.source, {
      theme: input.theme,
      height: input.height,
    })
}
