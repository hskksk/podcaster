import type { ChartHandler, VizHandle, VizHandlerContext } from './types'

export interface VegaEmbedViewLike {
  finalize: () => void
  resize: () => void
  width?: (value?: number) => number
}

export interface VegaEmbedResultLike {
  view: VegaEmbedViewLike
}

export interface VegaEmbedLike {
  (container: HTMLElement, spec: unknown, options?: Record<string, unknown>): Promise<VegaEmbedResultLike>
}

function vegaLiteHeight(context: VizHandlerContext, container: HTMLElement): number {
  const raw = context.height?.trim()
  if (raw && /^\d+$/.test(raw)) return Number(raw)
  const fromDom = container.clientHeight
  return fromDom > 0 ? fromDom : 320
}

async function containerWidth(container: HTMLElement): Promise<number> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const width = container.clientWidth
    if (width > 0) return width
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
  return container.clientWidth || 640
}

/** Fills the Markdoc canvas unless the author set width/height/autosize explicitly. */
export function normalizeVegaLiteSpec(
  spec: unknown,
  context: VizHandlerContext,
  container: HTMLElement,
  widthPx: number,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    spec !== null && typeof spec === 'object' && !Array.isArray(spec)
      ? { ...(spec as Record<string, unknown>) }
      : { mark: spec }

  if (base.width === undefined || base.width === 'container') base.width = widthPx
  if (base.height === undefined || base.height === 'container') base.height = vegaLiteHeight(context, container)
  if (base.autosize === undefined) {
    base.autosize = { type: 'fit', contains: 'padding', resize: true }
  }
  return base
}

export function createVegaLiteChartHandler(vegaEmbed: VegaEmbedLike): ChartHandler {
  return async (container, spec, context) => {
    const widthPx = await containerWidth(container)
    const normalized = normalizeVegaLiteSpec(spec, context, container, widthPx)
    const heightPx = typeof normalized.height === 'number' ? normalized.height : vegaLiteHeight(context, container)

    const result = await vegaEmbed(container, normalized, {
      actions: { export: true, source: false, compiled: false, editor: false },
      theme: context.theme === 'dark' ? 'dark' : undefined,
      width: widthPx,
      height: heightPx,
    })

    const handle: VizHandle = {
      dispose: () => result.view.finalize(),
      resize: () => {
        const next = container.clientWidth
        if (next > 0) result.view.width?.(next)
        result.view.resize()
      },
    }
    return handle
  }
}
