"use client";
import { childText, childDiagramSource, toErrorMessage, createMarkdocConfig, escapeHtml } from './chunk-EPBHTSGG.js';
export { builtinNodes, builtinTags, childText, createMarkdocConfig, slugify } from './chunk-EPBHTSGG.js';
import Markdoc from '@markdoc/markdoc';
import * as React from 'react';
import { createContext, useContext, useMemo, useState, useEffect, createElement, Children, isValidElement, useId, useRef } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';

var BADGE_TYPES = /* @__PURE__ */ new Set(["default", "info", "success", "warning", "danger"]);
function Badge({ type = "default", children }) {
  const kind = BADGE_TYPES.has(type) ? type : "default";
  return /* @__PURE__ */ jsx("span", { className: `markdoc-badge markdoc-badge--${kind}`, "data-badge-type": kind, children });
}
var CALLOUT_TYPES = ["note", "tip", "warning", "error"];
function CalloutIcon({ type }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true
  };
  if (type === "warning") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx("path", { d: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" }),
      /* @__PURE__ */ jsx("path", { d: "M12 9v4" }),
      /* @__PURE__ */ jsx("path", { d: "M12 17h.01" })
    ] });
  }
  if (type === "error") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
      /* @__PURE__ */ jsx("path", { d: "m15 9-6 6" }),
      /* @__PURE__ */ jsx("path", { d: "m9 9 6 6" })
    ] });
  }
  if (type === "tip") {
    return /* @__PURE__ */ jsxs("svg", { ...common, children: [
      /* @__PURE__ */ jsx("path", { d: "M9 18h6" }),
      /* @__PURE__ */ jsx("path", { d: "M10 22h4" }),
      /* @__PURE__ */ jsx("path", { d: "M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" })
    ] });
  }
  return /* @__PURE__ */ jsxs("svg", { ...common, children: [
    /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
    /* @__PURE__ */ jsx("path", { d: "M12 16v-4" }),
    /* @__PURE__ */ jsx("path", { d: "M12 8h.01" })
  ] });
}
function Callout({ type = "note", children }) {
  const kind = CALLOUT_TYPES.includes(type) ? type : "note";
  return /* @__PURE__ */ jsxs("aside", { className: `markdoc-callout markdoc-callout--${kind}`, "data-callout-type": kind, children: [
    /* @__PURE__ */ jsx("span", { className: "markdoc-callout__icon", children: /* @__PURE__ */ jsx(CalloutIcon, { type: kind }) }),
    /* @__PURE__ */ jsx("div", { className: "markdoc-callout__body", children })
  ] });
}
var MarkdocContext = createContext({});
function MarkdocProvider({ value, children }) {
  return /* @__PURE__ */ jsx(MarkdocContext.Provider, { value, children });
}
function useMarkdocRuntime() {
  return useContext(MarkdocContext);
}
function CodeFence({
  content,
  children,
  language,
  processed = false
}) {
  const code = (typeof content === "string" ? content : childText(children)).replace(/\n$/, "");
  const { highlighter } = useMarkdocRuntime();
  const preview = useMemo(() => {
    if (processed || !highlighter) return null;
    try {
      return highlighter({ code, language });
    } catch {
      return null;
    }
  }, [processed, highlighter, code, language]);
  const [asyncResult, setAsyncResult] = useState(null);
  useEffect(() => {
    if (!(preview instanceof Promise)) return;
    const token = preview;
    let cancelled = false;
    token.then((result) => {
      if (!cancelled) setAsyncResult({ token, result });
    }).catch(() => {
      if (!cancelled) setAsyncResult({ token, result: null });
    });
    return () => {
      cancelled = true;
    };
  }, [preview]);
  if (processed) {
    return /* @__PURE__ */ jsx("div", { className: "markdoc-code markdoc-code--rich", children });
  }
  const highlighted = preview instanceof Promise ? asyncResult?.token === preview ? asyncResult.result : null : preview;
  if (highlighted) {
    const className = ["markdoc-code", highlighted.className].filter(Boolean).join(" ");
    return /* @__PURE__ */ jsx("pre", { className, style: highlighted.style, children: /* @__PURE__ */ jsx(
      "code",
      {
        className: language ? `language-${language}` : void 0,
        dangerouslySetInnerHTML: { __html: highlighted.html }
      }
    ) });
  }
  return /* @__PURE__ */ jsx("pre", { className: "markdoc-code", children: /* @__PURE__ */ jsx("code", { className: language ? `language-${language}` : void 0, children: code }) });
}
function Details({ summary, open = false, children }) {
  return /* @__PURE__ */ jsxs("details", { className: "markdoc-details", open: Boolean(open), children: [
    /* @__PURE__ */ jsx("summary", { className: "markdoc-details__summary", children: summary ?? "Details" }),
    /* @__PURE__ */ jsx("div", { className: "markdoc-details__body", children })
  ] });
}
function canvasStyle(height) {
  if (!height?.trim()) return void 0;
  const value = height.trim();
  const normalized = /^\d+$/.test(value) ? `${value}px` : value;
  return { height: normalized, minHeight: normalized };
}
function MountedViz({ kind, engine, source, height, children }) {
  const { chartRenderer, graphRenderer, theme } = useMarkdocRuntime();
  const renderer = kind === "chart" ? chartRenderer : graphRenderer;
  const src = (source ?? childDiagramSource(children)).trim();
  const style = canvasStyle(height);
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const container = containerRef.current;
    let cancelled = false;
    let handle;
    let resizeObserver;
    setError(null);
    container?.replaceChildren();
    if (!container || !renderer || src.length === 0) return;
    const mount = kind === "chart" ? chartRenderer?.({ engine, source: src, theme, height }, container) : graphRenderer?.({ engine, source: src, theme, height }, container);
    if (!mount) return;
    mount.then((result) => {
      if (cancelled) {
        result.handle?.dispose();
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      handle = result.handle;
      if (handle?.resize && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => handle?.resize?.());
        resizeObserver.observe(container);
      }
    }).catch((cause) => {
      if (!cancelled) setError(toErrorMessage(cause));
    });
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      handle?.dispose();
      container?.replaceChildren();
    };
  }, [kind, engine, src, height, chartRenderer, graphRenderer, theme]);
  const staticMessage = src.length === 0 ? `Empty ${kind}` : !renderer ? `No ${kind} renderer configured` : null;
  const showFallback = Boolean(staticMessage || error);
  const className = `markdoc-${kind} markdoc-${kind}--${engine}${showFallback ? ` markdoc-${kind}--fallback` : ""}`;
  return /* @__PURE__ */ jsxs("figure", { className, "data-chart-engine": kind === "chart" ? engine : void 0, "data-graph-engine": kind === "graph" ? engine : void 0, children: [
    /* @__PURE__ */ jsx("div", { ref: containerRef, className: `markdoc-${kind}__canvas`, style }),
    showFallback && src.length > 0 && /* @__PURE__ */ jsx("pre", { className: `markdoc-${kind}__source`, children: /* @__PURE__ */ jsx("code", { children: src }) }),
    (staticMessage || error) && /* @__PURE__ */ jsx("figcaption", { className: `markdoc-${kind}__error`, role: "alert", children: staticMessage ?? error })
  ] });
}
function Chart({
  engine,
  source,
  height,
  children
}) {
  return /* @__PURE__ */ jsx(MountedViz, { kind: "chart", engine, source, height, children });
}
function Diagram({ type = "mermaid", source, children }) {
  const kind = type === "d2" ? "d2" : "mermaid";
  const src = (source ?? childDiagramSource(children)).trim();
  const { diagramRenderer, theme } = useMarkdocRuntime();
  const [svg, setSvg] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    if (!diagramRenderer || src.length === 0) return;
    diagramRenderer({ type: kind, source: src, theme }).then((result) => {
      if (cancelled) return;
      if (result.svg) {
        setSvg(result.svg);
      } else {
        setError(result.error ?? "Unable to render diagram");
      }
    }).catch((cause) => {
      if (!cancelled) setError(toErrorMessage(cause));
    });
    return () => {
      cancelled = true;
    };
  }, [src, kind, diagramRenderer, theme]);
  if (svg) {
    return /* @__PURE__ */ jsx("figure", { className: `markdoc-diagram markdoc-diagram--${kind}`, "data-diagram-type": kind, children: /* @__PURE__ */ jsx("div", { className: "markdoc-diagram__canvas", dangerouslySetInnerHTML: { __html: svg } }) });
  }
  const message = src.length === 0 ? "Empty diagram" : !diagramRenderer ? "No diagram renderer configured" : error;
  return /* @__PURE__ */ jsxs("figure", { className: `markdoc-diagram markdoc-diagram--${kind} markdoc-diagram--fallback`, "data-diagram-type": kind, children: [
    src.length > 0 && /* @__PURE__ */ jsx("pre", { className: "markdoc-diagram__source", children: /* @__PURE__ */ jsx("code", { children: src }) }),
    message && /* @__PURE__ */ jsx("figcaption", { className: "markdoc-diagram__error", role: "alert", children: message })
  ] });
}
function Graph({
  engine,
  source,
  height,
  children
}) {
  return /* @__PURE__ */ jsx(MountedViz, { kind: "graph", engine, source, height, children });
}
function clampLevel(level) {
  const value = Number(level);
  if (!Number.isFinite(value)) return 1;
  return Math.min(6, Math.max(1, Math.trunc(value)));
}
function Heading({ level, id, children }) {
  const tag = `h${clampLevel(level)}`;
  return createElement(tag, { ...id ? { id } : {}, className: "markdoc-heading" }, children);
}
function Kbd({ children }) {
  return /* @__PURE__ */ jsx("kbd", { className: "markdoc-kbd", children });
}
function Math2({ display = true, children }) {
  const tex = childText(children).trim();
  const { mathRenderer } = useMarkdocRuntime();
  const [html, setHtml] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!mathRenderer) {
      setHtml(null);
      return;
    }
    setHtml(null);
    Promise.resolve(mathRenderer({ tex, display })).then((value) => {
      if (!cancelled) setHtml(value);
    }).catch(() => {
      if (!cancelled) setHtml(null);
    });
    return () => {
      cancelled = true;
    };
  }, [tex, display, mathRenderer]);
  const className = display ? "markdoc-math markdoc-math--block" : "markdoc-math markdoc-math--inline";
  if (html != null) {
    return /* @__PURE__ */ jsx("span", { className, dangerouslySetInnerHTML: { __html: html } });
  }
  const fallback = display ? `\\[${tex}\\]` : `\\(${tex}\\)`;
  return /* @__PURE__ */ jsx("span", { className, children: fallback });
}
function Tab({ children }) {
  return /* @__PURE__ */ jsx("div", { className: "markdoc-tab", children });
}
function Tabs({ children }) {
  const items = Children.toArray(children).filter(isValidElement);
  const [requested, setRequested] = useState(0);
  const baseId = useId();
  const tabRefs = useRef([]);
  if (items.length === 0) return null;
  const active = Math.min(requested, items.length - 1);
  function onKeyDown(event, index) {
    const last = items.length - 1;
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next == null) return;
    event.preventDefault();
    setRequested(next);
    tabRefs.current[next]?.focus();
  }
  return /* @__PURE__ */ jsxs("div", { className: "markdoc-tabs", children: [
    /* @__PURE__ */ jsx("div", { className: "markdoc-tabs__list", role: "tablist", "aria-orientation": "horizontal", children: items.map((item, index) => /* @__PURE__ */ jsx(
      "button",
      {
        ref: (element) => {
          tabRefs.current[index] = element;
        },
        id: `${baseId}-tab-${index}`,
        type: "button",
        role: "tab",
        "aria-selected": index === active,
        "aria-controls": `${baseId}-panel`,
        tabIndex: index === active ? 0 : -1,
        className: `markdoc-tabs__tab${index === active ? " markdoc-tabs__tab--active" : ""}`,
        onClick: () => setRequested(index),
        onKeyDown: (event) => onKeyDown(event, index),
        children: item.props.label ?? `Tab ${index + 1}`
      },
      index
    )) }),
    /* @__PURE__ */ jsx(
      "div",
      {
        id: `${baseId}-panel`,
        className: "markdoc-tabs__panel",
        role: "tabpanel",
        "aria-labelledby": `${baseId}-tab-${active}`,
        children: items[active]
      }
    )
  ] });
}

// src/components/index.ts
var builtinComponents = {
  Badge,
  Callout,
  CodeFence,
  Details,
  Chart,
  Diagram,
  Graph,
  Heading,
  Kbd,
  Math: Math2,
  Tab,
  Tabs
};
function MarkdocView({
  source,
  config,
  components,
  className,
  fenceTags = "document",
  onError,
  highlighter,
  diagramRenderer,
  chartRenderer,
  graphRenderer,
  mathRenderer,
  theme
}) {
  const mergedConfig = useMemo(() => createMarkdocConfig(config, { fenceTags }), [config, fenceTags]);
  const mergedComponents = useMemo(
    () => ({ ...builtinComponents, ...components }),
    [components]
  );
  const runtime = useMemo(
    () => ({ highlighter, diagramRenderer, chartRenderer, graphRenderer, mathRenderer, theme }),
    [highlighter, diagramRenderer, chartRenderer, graphRenderer, mathRenderer, theme]
  );
  const rendered = useMemo(() => {
    try {
      const ast = Markdoc.parse(source);
      const errors = Markdoc.validate(ast, mergedConfig);
      const content = Markdoc.transform(ast, mergedConfig);
      return { content, errors, thrown: void 0 };
    } catch (thrown) {
      return { content: null, errors: [], thrown };
    }
  }, [source, mergedConfig]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    const report = onErrorRef.current;
    if (!report) return;
    if (rendered.thrown !== void 0) report(rendered.thrown);
    else if (rendered.errors.length > 0) report(rendered.errors);
  }, [rendered]);
  return /* @__PURE__ */ jsx(MarkdocProvider, { value: runtime, children: /* @__PURE__ */ jsx("div", { className: className ? `markdoc-root ${className}` : "markdoc-root", "data-markdoc-view": "", children: rendered.content ? Markdoc.renderers.react(rendered.content, React, { components: mergedComponents }) : null }) });
}

// src/adapters/mermaid.ts
var renderCount = 0;
function mermaidTheme(theme) {
  return theme === "dark" ? "dark" : "default";
}
function createMermaidRenderer(mermaid) {
  let appliedTheme;
  return async ({ source, theme }) => {
    try {
      const nextTheme = mermaidTheme(theme);
      if (appliedTheme !== nextTheme) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: nextTheme
        });
        appliedTheme = nextTheme;
      }
      renderCount += 1;
      const result = await mermaid.render(`markdoc-diagram-${renderCount}`, source);
      return { svg: result.svg };
    } catch (error) {
      return { error: toErrorMessage(error) };
    }
  };
}

// src/adapters/d2.ts
var renderCount2 = 0;
function createD2Renderer(d2) {
  return async ({ source }) => {
    try {
      renderCount2 += 1;
      const compiled = await d2.compile(source);
      const svg = await d2.render(compiled.diagram, {
        ...compiled.renderOptions,
        noXMLTag: true,
        salt: `markdoc-diagram-${renderCount2}`
      });
      return { svg };
    } catch (error) {
      return { error: toErrorMessage(error) };
    }
  };
}

// src/adapters/vizMount.ts
async function mountWithHandler(handlers, engine, engineLabel, container, source, context) {
  const handler = handlers[engine];
  if (!handler) {
    return { error: `No ${engineLabel} handler configured for engine "${engine}"` };
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (cause) {
    return { error: `Invalid JSON: ${toErrorMessage(cause)}` };
  }
  try {
    const handle = await handler(container, parsed, context);
    return { handle };
  } catch (cause) {
    return { error: toErrorMessage(cause) };
  }
}
function createChartRenderer(handlers) {
  return (input, container) => mountWithHandler(handlers, input.engine, "chart", container, input.source, {
    theme: input.theme,
    height: input.height
  });
}
function createGraphRenderer(handlers) {
  return (input, container) => mountWithHandler(handlers, input.engine, "graph", container, input.source, {
    theme: input.theme,
    height: input.height
  });
}

// src/adapters/echarts.ts
function echartsThemeName(theme) {
  return theme === "dark" ? "dark" : theme === "light" ? void 0 : void 0;
}
function createEChartsChartHandler(echarts) {
  return (container, spec, { theme }) => {
    echarts.getInstanceByDom?.(container)?.dispose();
    const instance = echarts.init(container, echartsThemeName(theme), { renderer: "canvas" });
    instance.setOption(spec);
    const handle = {
      dispose: () => instance.dispose(),
      resize: () => instance.resize()
    };
    return handle;
  };
}

// src/adapters/vegaLite.ts
function vegaLiteHeight(context, container) {
  const raw = context.height?.trim();
  if (raw && /^\d+$/.test(raw)) return Number(raw);
  const fromDom = container.clientHeight;
  return fromDom > 0 ? fromDom : 320;
}
async function containerWidth(container) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const width = container.clientWidth;
    if (width > 0) return width;
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  return container.clientWidth || 640;
}
function normalizeVegaLiteSpec(spec, context, container, widthPx) {
  const base = spec !== null && typeof spec === "object" && !Array.isArray(spec) ? { ...spec } : { mark: spec };
  if (base.width === void 0 || base.width === "container") base.width = widthPx;
  if (base.height === void 0 || base.height === "container") base.height = vegaLiteHeight(context, container);
  if (base.autosize === void 0) {
    base.autosize = { type: "fit", contains: "padding", resize: true };
  }
  return base;
}
function createVegaLiteChartHandler(vegaEmbed) {
  return async (container, spec, context) => {
    const widthPx = await containerWidth(container);
    const normalized = normalizeVegaLiteSpec(spec, context, container, widthPx);
    const heightPx = typeof normalized.height === "number" ? normalized.height : vegaLiteHeight(context, container);
    const result = await vegaEmbed(container, normalized, {
      actions: { export: true, source: false, compiled: false, editor: false },
      theme: context.theme === "dark" ? "dark" : void 0,
      width: widthPx,
      height: heightPx
    });
    const handle = {
      dispose: () => result.view.finalize(),
      resize: () => {
        const next = container.clientWidth;
        if (next > 0) result.view.width?.(next);
        result.view.resize();
      }
    };
    return handle;
  };
}

// src/adapters/cytoscape.ts
function createCytoscapeGraphHandler(cytoscape) {
  return (container, spec, _ctx) => {
    const options = spec !== null && typeof spec === "object" && !Array.isArray(spec) ? { ...spec } : { elements: spec };
    delete options.container;
    const instance = cytoscape({ ...options, container });
    const handle = {
      dispose: () => instance.destroy(),
      resize: () => instance.resize()
    };
    return handle;
  };
}

// src/adapters/highlightjs.ts
function createHighlightJsRenderer(hljs) {
  return ({ code, language }) => {
    const supported = language != null && (hljs.getLanguage == null || Boolean(hljs.getLanguage(language)));
    if (supported) {
      return { html: hljs.highlight(code, { language, ignoreIllegals: true }).value };
    }
    return { html: escapeHtml(code) };
  };
}

// src/adapters/shiki.ts
function attribute(source, name) {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`));
  return match?.[2] ?? match?.[3];
}
function cssStyleToReact(style) {
  if (!style) return void 0;
  const result = {};
  for (const declaration of style.split(";")) {
    const index = declaration.indexOf(":");
    if (index === -1) continue;
    const property = declaration.slice(0, index).trim();
    const value = declaration.slice(index + 1).trim();
    if (!property || !value) continue;
    const key = property.startsWith("--") ? property : property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
function splitShikiBlock(html, code) {
  const pre = html.trim().match(/^<pre\b([^>]*)>([\s\S]*)<\/pre>$/);
  if (!pre) return { html: escapeHtml(code) };
  const inner = pre[2].match(/^\s*<code\b[^>]*>([\s\S]*)<\/code>\s*$/);
  return {
    html: inner?.[1] ?? escapeHtml(code),
    className: attribute(pre[1], "class"),
    style: cssStyleToReact(attribute(pre[1], "style"))
  };
}
function createShikiRenderer(highlighter, options = {}) {
  const theme = options.theme ?? "github-dark";
  return async ({ code, language }) => {
    try {
      const html = await highlighter.codeToHtml(code, { lang: language || "text", theme });
      return splitShikiBlock(html, code);
    } catch {
      return { html: escapeHtml(code) };
    }
  };
}

// src/adapters/katex.ts
function createKatexRenderer(katex, options = {}) {
  return ({ tex, display }) => {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, ...options });
    } catch {
      return display ? `\\[${tex}\\]` : `\\(${tex}\\)`;
    }
  };
}

export { Badge, Callout, Chart, CodeFence, Details, Diagram, Graph, Heading, Kbd, MarkdocProvider, MarkdocView, Math2 as Math, Tab, Tabs, builtinComponents, createChartRenderer, createCytoscapeGraphHandler, createD2Renderer, createEChartsChartHandler, createGraphRenderer, createHighlightJsRenderer, createKatexRenderer, createMermaidRenderer, createShikiRenderer, createVegaLiteChartHandler, normalizeVegaLiteSpec, useMarkdocRuntime };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map