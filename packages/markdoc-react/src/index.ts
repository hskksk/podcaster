export { MarkdocView, type MarkdocViewProps } from './renderer/MarkdocView'

export { MarkdocProvider, useMarkdocRuntime, type MarkdocRuntime } from './context/MarkdocProvider'

export { createMarkdocConfig } from './config/createConfig'
export { builtinNodes } from './config/nodes'
export { builtinTags } from './config/tags'
export type { CreateMarkdocConfigOptions, FenceTagMode, MarkdocExtensions } from './config/types'

export { builtinComponents, type MarkdocComponentMap } from './components'
export {
  Badge,
  Callout,
  CodeFence,
  Details,
  Chart,
  Diagram,
  Graph,
  Heading,
  Kbd,
  Math,
  Tab,
  Tabs,
} from './components'

export { childText, slugify } from './text'

export { createMermaidRenderer, type MermaidLike, type MermaidRenderResult } from './adapters/mermaid'
export { createD2Renderer, type D2CompileResult, type D2Like } from './adapters/d2'
export { createChartRenderer, createGraphRenderer } from './adapters/vizMount'
export { createEChartsChartHandler, type EChartsInstanceLike, type EChartsLike } from './adapters/echarts'
export {
  createVegaLiteChartHandler,
  normalizeVegaLiteSpec,
  type VegaEmbedLike,
  type VegaEmbedResultLike,
} from './adapters/vegaLite'
export { createCytoscapeGraphHandler, type CytoscapeInstanceLike, type CytoscapeLike } from './adapters/cytoscape'
export { createHighlightJsRenderer, type HighlightJsLike } from './adapters/highlightjs'
export { createShikiRenderer, type ShikiHighlighterLike, type ShikiRendererOptions } from './adapters/shiki'
export { createKatexRenderer, type KatexLike } from './adapters/katex'
export type {
  DiagramInput,
  DiagramRenderer,
  DiagramResult,
  DiagramTheme,
  DiagramType,
  ChartEngine,
  ChartHandler,
  ChartInput,
  ChartRenderer,
  GraphEngine,
  GraphHandler,
  GraphInput,
  GraphRenderer,
  Highlighter,
  HighlightInput,
  HighlightResult,
  MathInput,
  MathRenderer,
  VizHandle,
  VizHandlerContext,
  VizMountResult,
} from './adapters/types'
