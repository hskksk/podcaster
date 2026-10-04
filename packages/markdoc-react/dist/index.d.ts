import * as react_jsx_runtime from 'react/jsx-runtime';
import * as react from 'react';
import { ReactNode, ComponentType, CSSProperties } from 'react';
import { M as MarkdocExtensions, F as FenceTagMode } from './server-hmfli07L.js';
export { C as CreateMarkdocConfigOptions, b as builtinNodes, a as builtinTags, c as childText, d as createMarkdocConfig, s as slugify } from './server-hmfli07L.js';
import '@markdoc/markdoc';

declare function Badge({ type, children }: {
    type?: string;
    children?: ReactNode;
}): react_jsx_runtime.JSX.Element;

declare function Callout({ type, children }: {
    type?: string;
    children?: ReactNode;
}): react_jsx_runtime.JSX.Element;

declare function CodeFence({ content, children, language, processed, }: {
    content?: string;
    children?: ReactNode;
    language?: string;
    processed?: boolean;
}): react_jsx_runtime.JSX.Element;

declare function Details({ summary, open, children }: {
    summary?: string;
    open?: boolean;
    children?: ReactNode;
}): react_jsx_runtime.JSX.Element;

declare function Chart({ engine, source, height, children, }: {
    engine: string;
    source?: string;
    height?: string;
    children?: ReactNode;
}): react_jsx_runtime.JSX.Element;

declare function Diagram({ type, source, children }: {
    type?: string;
    source?: string;
    children?: ReactNode;
}): react_jsx_runtime.JSX.Element;

declare function Graph({ engine, source, height, children, }: {
    engine: string;
    source?: string;
    height?: string;
    children?: ReactNode;
}): react_jsx_runtime.JSX.Element;

declare function Heading({ level, id, children }: {
    level?: number;
    id?: string;
    children?: ReactNode;
}): react.DetailedReactHTMLElement<{
    className: string;
    id?: string | undefined;
}, HTMLElement>;

declare function Kbd({ children }: {
    children?: ReactNode;
}): react_jsx_runtime.JSX.Element;

declare function Math({ display, children }: {
    display?: boolean;
    children?: ReactNode;
}): react_jsx_runtime.JSX.Element;

interface TabProps {
    label?: string;
    children?: ReactNode;
}
declare function Tab({ children }: TabProps): react_jsx_runtime.JSX.Element;
declare function Tabs({ children }: {
    children?: ReactNode;
}): react_jsx_runtime.JSX.Element | null;

type MarkdocComponentMap = Record<string, ComponentType<any>>;
declare const builtinComponents: MarkdocComponentMap;

interface HighlightInput {
    code: string;
    language?: string;
}
interface HighlightResult {
    /** Inner HTML of the code element, not a wrapping `<pre>`. */
    html: string;
    className?: string;
    style?: CSSProperties;
}
type Highlighter = (input: HighlightInput) => HighlightResult | Promise<HighlightResult>;
type DiagramType = 'mermaid' | 'd2';
interface DiagramInput {
    type: DiagramType;
    source: string;
    theme?: DiagramTheme;
}
interface DiagramResult {
    svg?: string;
    error?: string;
}
type DiagramRenderer = (input: DiagramInput) => Promise<DiagramResult>;
interface MathInput {
    tex: string;
    display: boolean;
}
type MathRenderer = (input: MathInput) => string | Promise<string>;
type DiagramTheme = 'light' | 'dark';
interface VizHandle {
    dispose: () => void;
    resize?: () => void;
}
interface VizMountResult {
    handle?: VizHandle;
    error?: string;
}
type ChartEngine = 'echarts' | 'vega-lite';
type GraphEngine = 'cytoscape';
interface ChartInput {
    engine: ChartEngine;
    source: string;
    theme?: DiagramTheme;
    height?: string;
}
interface GraphInput {
    engine: GraphEngine;
    source: string;
    theme?: DiagramTheme;
    height?: string;
}
interface VizHandlerContext {
    theme?: DiagramTheme;
    /** Tag `height` attribute (e.g. `320` or `40vh`). */
    height?: string;
}
type ChartHandler = (container: HTMLElement, spec: unknown, context: VizHandlerContext) => Promise<VizHandle> | VizHandle;
type GraphHandler = (container: HTMLElement, spec: unknown, context: VizHandlerContext) => Promise<VizHandle> | VizHandle;
type ChartRenderer = (input: ChartInput, container: HTMLElement) => Promise<VizMountResult>;
type GraphRenderer = (input: GraphInput, container: HTMLElement) => Promise<VizMountResult>;

interface MarkdocRuntime {
    highlighter?: Highlighter;
    diagramRenderer?: DiagramRenderer;
    chartRenderer?: ChartRenderer;
    graphRenderer?: GraphRenderer;
    mathRenderer?: MathRenderer;
    theme?: DiagramTheme;
}
declare function MarkdocProvider({ value, children }: {
    value: MarkdocRuntime;
    children: ReactNode;
}): react_jsx_runtime.JSX.Element;
declare function useMarkdocRuntime(): MarkdocRuntime;

interface MarkdocViewProps extends MarkdocRuntime {
    source: string;
    config?: MarkdocExtensions;
    components?: MarkdocComponentMap;
    className?: string;
    /**
     * `document` lets each fence choose whether tags inside it run.
     * `off` renders every fence as literal text. The document cannot turn that back on.
     */
    fenceTags?: FenceTagMode;
    /** Thrown transform errors, or Markdoc validation errors. Validation does not stop rendering. */
    onError?: (error: unknown) => void;
}
declare function MarkdocView({ source, config, components, className, fenceTags, onError, highlighter, diagramRenderer, chartRenderer, graphRenderer, mathRenderer, theme, }: MarkdocViewProps): react_jsx_runtime.JSX.Element;

interface MermaidRenderResult {
    svg: string;
    bindFunctions?: (element: Element) => void;
}
interface MermaidLike {
    initialize: (config: Record<string, unknown>) => void;
    render: (id: string, text: string) => Promise<MermaidRenderResult>;
}
declare function createMermaidRenderer(mermaid: MermaidLike): DiagramRenderer;

interface D2CompileResult {
    diagram: unknown;
    renderOptions: Record<string, unknown>;
}
interface D2Like {
    compile: (source: string) => Promise<D2CompileResult>;
    render: (diagram: unknown, options: Record<string, unknown>) => Promise<string>;
}
declare function createD2Renderer(d2: D2Like): DiagramRenderer;

declare function createChartRenderer(handlers: Partial<Record<ChartEngine, ChartHandler>>): ChartRenderer;
declare function createGraphRenderer(handlers: Partial<Record<GraphEngine, GraphHandler>>): GraphRenderer;

interface EChartsInstanceLike {
    setOption: (option: unknown, opts?: unknown) => void;
    dispose: () => void;
    resize: () => void;
}
interface EChartsLike {
    init: (dom: HTMLElement, theme?: string | object | null, opts?: {
        renderer?: string;
    }) => EChartsInstanceLike;
    getInstanceByDom?: (dom: HTMLElement) => EChartsInstanceLike | undefined;
}
declare function createEChartsChartHandler(echarts: EChartsLike): ChartHandler;

interface VegaEmbedViewLike {
    finalize: () => void;
    resize: () => void;
    width?: (value?: number) => number;
}
interface VegaEmbedResultLike {
    view: VegaEmbedViewLike;
}
interface VegaEmbedLike {
    (container: HTMLElement, spec: unknown, options?: Record<string, unknown>): Promise<VegaEmbedResultLike>;
}
/** Fills the Markdoc canvas unless the author set width/height/autosize explicitly. */
declare function normalizeVegaLiteSpec(spec: unknown, context: VizHandlerContext, container: HTMLElement, widthPx: number): Record<string, unknown>;
declare function createVegaLiteChartHandler(vegaEmbed: VegaEmbedLike): ChartHandler;

interface CytoscapeInstanceLike {
    destroy: () => void;
    resize: () => void;
}
interface CytoscapeLike {
    (options: Record<string, unknown>): CytoscapeInstanceLike;
}
declare function createCytoscapeGraphHandler(cytoscape: CytoscapeLike): GraphHandler;

interface HighlightJsLike {
    getLanguage?: (name: string) => unknown;
    highlight: (code: string, options: {
        language: string;
        ignoreIllegals?: boolean;
    }) => {
        value: string;
    };
}
declare function createHighlightJsRenderer(hljs: HighlightJsLike): Highlighter;

interface ShikiHighlighterLike {
    codeToHtml: (code: string, options: {
        lang: string;
        theme: string;
    }) => Promise<string>;
}
interface ShikiRendererOptions {
    theme?: string;
}
declare function createShikiRenderer(highlighter: ShikiHighlighterLike, options?: ShikiRendererOptions): Highlighter;

interface KatexLike {
    renderToString: (tex: string, options?: Record<string, unknown>) => string;
}
declare function createKatexRenderer(katex: KatexLike, options?: Record<string, unknown>): MathRenderer;

export { Badge, Callout, Chart, type ChartEngine, type ChartHandler, type ChartInput, type ChartRenderer, CodeFence, type CytoscapeInstanceLike, type CytoscapeLike, type D2CompileResult, type D2Like, Details, Diagram, type DiagramInput, type DiagramRenderer, type DiagramResult, type DiagramTheme, type DiagramType, type EChartsInstanceLike, type EChartsLike, FenceTagMode, Graph, type GraphEngine, type GraphHandler, type GraphInput, type GraphRenderer, Heading, type HighlightInput, type HighlightJsLike, type HighlightResult, type Highlighter, type KatexLike, Kbd, type MarkdocComponentMap, MarkdocExtensions, MarkdocProvider, type MarkdocRuntime, MarkdocView, type MarkdocViewProps, Math, type MathInput, type MathRenderer, type MermaidLike, type MermaidRenderResult, type ShikiHighlighterLike, type ShikiRendererOptions, Tab, Tabs, type VegaEmbedLike, type VegaEmbedResultLike, type VizHandle, type VizHandlerContext, type VizMountResult, builtinComponents, createChartRenderer, createCytoscapeGraphHandler, createD2Renderer, createEChartsChartHandler, createGraphRenderer, createHighlightJsRenderer, createKatexRenderer, createMermaidRenderer, createShikiRenderer, createVegaLiteChartHandler, normalizeVegaLiteSpec, useMarkdocRuntime };
