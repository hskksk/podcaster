import type { CSSProperties } from 'react'

export interface HighlightInput {
  code: string
  language?: string
}

export interface HighlightResult {
  /** Inner HTML of the code element, not a wrapping `<pre>`. */
  html: string
  className?: string
  style?: CSSProperties
}

export type Highlighter = (input: HighlightInput) => HighlightResult | Promise<HighlightResult>

export type DiagramType = 'mermaid' | 'd2'

export interface DiagramInput {
  type: DiagramType
  source: string
  theme?: DiagramTheme
}

export interface DiagramResult {
  svg?: string
  error?: string
}

export type DiagramRenderer = (input: DiagramInput) => Promise<DiagramResult>

export interface MathInput {
  tex: string
  display: boolean
}

export type MathRenderer = (input: MathInput) => string | Promise<string>

export type DiagramTheme = 'light' | 'dark'

export interface VizHandle {
  dispose: () => void
  resize?: () => void
}

export interface VizMountResult {
  handle?: VizHandle
  error?: string
}

export type ChartEngine = 'echarts' | 'vega-lite'
export type GraphEngine = 'cytoscape'

export interface ChartInput {
  engine: ChartEngine
  source: string
  theme?: DiagramTheme
  height?: string
}

export interface GraphInput {
  engine: GraphEngine
  source: string
  theme?: DiagramTheme
  height?: string
}

export interface VizHandlerContext {
  theme?: DiagramTheme
  /** Tag `height` attribute (e.g. `320` or `40vh`). */
  height?: string
}

export type ChartHandler = (
  container: HTMLElement,
  spec: unknown,
  context: VizHandlerContext,
) => Promise<VizHandle> | VizHandle

export type GraphHandler = (
  container: HTMLElement,
  spec: unknown,
  context: VizHandlerContext,
) => Promise<VizHandle> | VizHandle

export type ChartRenderer = (input: ChartInput, container: HTMLElement) => Promise<VizMountResult>
export type GraphRenderer = (input: GraphInput, container: HTMLElement) => Promise<VizMountResult>
