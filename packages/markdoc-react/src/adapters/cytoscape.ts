import type { GraphHandler, VizHandle } from './types'

export interface CytoscapeInstanceLike {
  destroy: () => void
  resize: () => void
}

export interface CytoscapeLike {
  (options: Record<string, unknown>): CytoscapeInstanceLike
}

export function createCytoscapeGraphHandler(cytoscape: CytoscapeLike): GraphHandler {
  return (container, spec, _ctx) => {
    const options: Record<string, unknown> =
      spec !== null && typeof spec === 'object' && !Array.isArray(spec)
        ? { ...(spec as Record<string, unknown>) }
        : { elements: spec }

    delete options.container
    const instance = cytoscape({ ...options, container })
    const handle: VizHandle = {
      dispose: () => instance.destroy(),
      resize: () => instance.resize(),
    }
    return handle
  }
}
