import { readFileSync } from 'node:fs'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  MarkdocView,
  createChartRenderer,
  createCytoscapeGraphHandler,
  createEChartsChartHandler,
  createKatexRenderer,
  createMermaidRenderer,
  createShikiRenderer,
  normalizeVegaLiteSpec,
} from '../index'
import type { ChartRenderer, DiagramRenderer, GraphRenderer, Highlighter } from '../index'

const css = readFileSync('src/markdoc.css', 'utf8')

describe('MarkdocView', () => {
  it('renders core markdown', () => {
    render(<MarkdocView source={'# Hello\n\nSome **bold** text.'} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument()
    expect(screen.getByText('bold')).toBeInTheDocument()
  })

  it('renders a callout tag with its type', () => {
    render(<MarkdocView source={'{% callout type="warning" %}\nCareful now\n{% /callout %}'} />)

    expect(screen.getByText('Careful now')).toBeInTheDocument()
    expect(document.querySelector('[data-callout-type="warning"]')).not.toBeNull()
  })

  it('renders tabs and details tags', () => {
    const source = [
      '{% tabs %}',
      '{% tab label="Alpha" %}\nfirst\n{% /tab %}',
      '{% tab label="Beta" %}\nsecond\n{% /tab %}',
      '{% /tabs %}',
      '{% details summary="More" %}\nhidden body\n{% /details %}',
    ].join('\n')

    render(<MarkdocView source={source} />)

    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Beta' })).toBeInTheDocument()
    expect(screen.getByText('hidden body')).toBeInTheDocument()
  })

  it('keeps markdoc tags inside md fences literal', () => {
    render(<MarkdocView source={'```md\n{% callout %}not-a-tag{% /callout %}\n```'} />)

    expect(document.querySelector('.markdoc-callout')).toBeNull()
    expect(screen.getByText(/{% callout %}/)).toBeInTheDocument()
  })

  it('renders custom tags supplied through config and components', () => {
    render(
      <MarkdocView
        source={'{% chart label="revenue" /%}'}
        config={{
          tags: {
            chart: {
              render: 'Chart',
              selfClosing: true,
              attributes: { label: { type: String } },
            },
          },
        }}
        components={{ Chart: ({ label }: { label?: string }) => <div>chart:{label}</div> }}
      />,
    )

    expect(screen.getByText('chart:revenue')).toBeInTheDocument()
  })

  it('uses an injected highlighter for fences', async () => {
    const highlighter: Highlighter = vi.fn(() => ({ html: '<span class="tok">hi</span>' }))

    render(<MarkdocView source={'```ts\nconst x = 1\n```'} highlighter={highlighter} />)

    const token = await screen.findByText('hi')
    expect(token.closest('pre')).toHaveClass('markdoc-code')
    expect(token.parentElement?.tagName).toBe('CODE')
    expect(highlighter).toHaveBeenCalledWith({ code: 'const x = 1', language: 'ts' })
  })

  it('falls back to the raw source when a diagram renderer is missing', () => {
    render(<MarkdocView source={'{% diagram type="mermaid" %}\n```mermaid\nflowchart LR\n  A --> B\n```\n{% /diagram %}'} />)

    expect(screen.getByText('No diagram renderer configured')).toBeInTheDocument()
    expect(screen.getByText(/flowchart LR/)).toBeInTheDocument()
  })

  it('renders diagram svg through an injected renderer', async () => {
    const diagramRenderer: DiagramRenderer = vi.fn(async () => ({ svg: '<svg data-testid="diagram"></svg>' }))

    render(
      <MarkdocView
        source={'{% diagram %}\n```mermaid\nflowchart LR\n  A --> B\n```\n{% /diagram %}'}
        diagramRenderer={diagramRenderer}
      />,
    )

    expect(await screen.findByTestId('diagram')).toBeInTheDocument()
    expect(diagramRenderer).toHaveBeenCalledWith(expect.objectContaining({ type: 'mermaid' }))
  })

  it('runs tags inside a ts fence and lets the document opt out', () => {
    const { rerender } = render(<MarkdocView source={'```ts\n{% callout %}hi{% /callout %}\n```'} />)

    expect(document.querySelector('.markdoc-callout')).not.toBeNull()
    expect(screen.getByText('hi')).toBeInTheDocument()

    rerender(<MarkdocView source={'```ts {% process=false %}\n{% callout %}hi{% /callout %}\n```'} />)

    expect(document.querySelector('.markdoc-callout')).toBeNull()
    expect(screen.getByText(/{% callout %}/)).toBeInTheDocument()
  })

  it('lets a site turn fence tags off even when the document opts in', () => {
    const onError = vi.fn()

    render(
      <MarkdocView
        fenceTags="off"
        onError={onError}
        source={'```md {% process=true %}\n{% boom %}x{% /boom %}\n```'}
        config={{
          tags: {
            boom: {
              transform() {
                throw new Error('executed')
              },
            },
          },
        }}
      />,
    )

    expect(onError).not.toHaveBeenCalled()
    expect(screen.getByText(/{% boom %}/)).toBeInTheDocument()
    expect(document.querySelector('.markdoc-callout')).toBeNull()
  })

  it('moves tabs with the arrow keys', () => {
    const source = [
      '{% tabs %}',
      '{% tab label="Alpha" %}\nfirst\n{% /tab %}',
      '{% tab label="Beta" %}\nsecond\n{% /tab %}',
      '{% /tabs %}',
    ].join('\n')

    render(<MarkdocView source={source} />)

    const alpha = screen.getByRole('tab', { name: 'Alpha' })
    const beta = screen.getByRole('tab', { name: 'Beta' })
    expect(alpha).toHaveAttribute('tabindex', '0')
    expect(beta).toHaveAttribute('tabindex', '-1')
    expect(alpha.getAttribute('aria-controls')).toBe(document.querySelector('[role="tabpanel"]')?.id)

    fireEvent.keyDown(alpha, { key: 'ArrowRight' })

    expect(beta).toHaveAttribute('aria-selected', 'true')
    expect(beta).toHaveFocus()
    expect(screen.getByText('second')).toBeInTheDocument()
  })

  it('assigns stable unique heading ids', () => {
    const { rerender } = render(<MarkdocView source={'# Hello\n\n# Hello\n\n# !!!\n\n# Sample Heading {% #foo-bar %}'} />)

    const [first, second] = screen.getAllByRole('heading', { name: 'Hello' })
    expect(first).toHaveAttribute('id', 'hello')
    expect(second).toHaveAttribute('id', 'hello-2')
    expect(screen.getByRole('heading', { name: '!!!' })).not.toHaveAttribute('id')
    expect(screen.getByRole('heading', { name: /Sample Heading/ })).toHaveAttribute('id', 'foo-bar')

    rerender(<MarkdocView source={'# Hello'} />)
    expect(screen.getByRole('heading', { name: 'Hello' })).toHaveAttribute('id', 'hello')
  })

  it('renders display math as a span inside a paragraph', () => {
    const errors: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '))
    })

    render(<MarkdocView source={'{% math %}E = mc^2{% /math %}'} />)

    spy.mockRestore()
    const math = document.querySelector('.markdoc-math')
    expect(math?.tagName).toBe('SPAN')
    expect(math?.classList.contains('markdoc-math--block')).toBe(true)
    expect(math?.parentElement?.tagName).toBe('P')
    expect(errors.join('\n')).not.toContain('validateDOMNesting')
  })

  it('falls back when chart and graph renderers are missing', () => {
    render(
      <MarkdocView
        source={'{% chart engine="echarts" %}\n```json\n{"series":[]}\n```\n{% /chart %}'}
      />,
    )

    expect(screen.getByText('No chart renderer configured')).toBeInTheDocument()
    expect(screen.getByText(/"series"/)).toBeInTheDocument()

    render(
      <MarkdocView
        source={'{% graph engine="cytoscape" %}\n```json\n{"elements":[]}\n```\n{% /graph %}'}
      />,
    )

    expect(screen.getByText('No graph renderer configured')).toBeInTheDocument()
  })

  it('mounts chart and graph output through injected renderers', async () => {
    const chartRenderer: ChartRenderer = vi.fn(async (_input, container) => {
      container.innerHTML = '<div data-testid="chart-output">chart</div>'
      return { handle: { dispose: vi.fn() } }
    })
    const graphRenderer: GraphRenderer = vi.fn(async (_input, container) => {
      container.innerHTML = '<div data-testid="graph-output">graph</div>'
      return { handle: { dispose: vi.fn() } }
    })

    const { rerender } = render(
      <MarkdocView
        source={'{% chart engine="vega-lite" height="400" %}\n```json\n{"mark":"bar"}\n```\n{% /chart %}'}
        chartRenderer={chartRenderer}
      />,
    )

    expect(await screen.findByTestId('chart-output')).toBeInTheDocument()
    expect(chartRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ engine: 'vega-lite', source: '{"mark":"bar"}', height: '400' }),
      expect.any(HTMLElement),
    )

    rerender(
      <MarkdocView
        source={'{% graph engine="cytoscape" %}\n{"elements":[{"data":{"id":"a"}}]}\n{% /graph %}'}
        graphRenderer={graphRenderer}
      />,
    )

    expect(await screen.findByTestId('graph-output')).toBeInTheDocument()
    expect(graphRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ engine: 'cytoscape' }),
      expect.any(HTMLElement),
    )
  })

  it('rejects unknown chart engines at validation time', () => {
    const onError = vi.fn()

    render(
      <MarkdocView
        source={'{% chart engine="cytoscape" source="{}" /%}'}
        onError={onError}
      />,
    )

    expect(onError).toHaveBeenCalled()
    expect(JSON.stringify(onError.mock.calls[0]?.[0])).toContain('engine')
  })

  it('renders a diagram from a source attribute or a plain body', async () => {
    const diagramRenderer: DiagramRenderer = vi.fn(async () => ({ svg: '<svg data-testid="diagram"></svg>' }))
    const { rerender } = render(
      <MarkdocView source={'{% diagram source="flowchart LR" /%}'} diagramRenderer={diagramRenderer} />,
    )

    expect(await screen.findByTestId('diagram')).toBeInTheDocument()
    expect(diagramRenderer).toHaveBeenCalledWith(expect.objectContaining({ type: 'mermaid', source: 'flowchart LR' }))

    rerender(
      <MarkdocView
        source={'{% diagram %}\nflowchart LR\n  A --> B\n{% /diagram %}'}
        diagramRenderer={diagramRenderer}
      />,
    )

    expect(diagramRenderer).toHaveBeenCalledWith(expect.objectContaining({ source: 'flowchart LR\nA --> B' }))

    rerender(
      <MarkdocView
        source={'{% diagram type="d2" %}\n```mermaid\nx -> y\n```\n{% /diagram %}'}
        diagramRenderer={diagramRenderer}
      />,
    )

    expect(diagramRenderer).toHaveBeenCalledWith(expect.objectContaining({ type: 'd2', source: 'x -> y' }))
  })

  it('reports validation errors without dropping the document', () => {
    const onError = vi.fn()

    render(<MarkdocView source={'{% callout %}\nno end'} onError={onError} />)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(Array.isArray(onError.mock.calls[0]?.[0])).toBe(true)
    expect(screen.getByText(/no end/)).toBeInTheDocument()
  })

  it('reports transform failures through onError', () => {
    const onError = vi.fn()

    render(
      <MarkdocView
        source={'# ok\n\nbody text'}
        config={{
          nodes: {
            paragraph: {
              transform() {
                throw new Error('boom')
              },
            },
          },
        }}
        onError={onError}
      />,
    )

    expect(onError).toHaveBeenCalledTimes(1)
  })
})

describe('adapters', () => {
  it('mermaid adapter uses strict mode and reinitializes only when the theme changes', async () => {
    const renderMock = vi.fn(async () => ({ svg: '<svg />' }))
    const initialize = vi.fn()
    const diagramRenderer = createMermaidRenderer({ initialize, render: renderMock })

    const result = await diagramRenderer({ type: 'mermaid', source: 'flowchart LR', theme: 'dark' })
    await diagramRenderer({ type: 'mermaid', source: 'flowchart LR', theme: 'dark' })
    await diagramRenderer({ type: 'mermaid', source: 'flowchart LR', theme: 'light' })

    expect(result.svg).toBe('<svg />')
    expect(renderMock).toHaveBeenCalledWith(expect.any(String), 'flowchart LR')
    expect(initialize).toHaveBeenCalledTimes(2)
    expect(initialize).toHaveBeenNthCalledWith(1, expect.objectContaining({ securityLevel: 'strict', theme: 'dark' }))
    expect(initialize).toHaveBeenNthCalledWith(2, expect.objectContaining({ securityLevel: 'strict', theme: 'default' }))
  })

  it('shiki adapter returns inner html and lifts the pre styles', async () => {
    const highlighter = createShikiRenderer({
      codeToHtml: async (code) =>
        `<pre class="shiki github-dark" style="background-color:#111;color:#eee"><code><span class="line">${code}</span></code></pre>`,
    })

    const result = await highlighter({ code: 'const x = 1', language: 'ts' })

    expect(result.html).toBe('<span class="line">const x = 1</span>')
    expect(result.className).toBe('shiki github-dark')
    expect(result.style).toMatchObject({ backgroundColor: '#111', color: '#eee' })
  })

  it('keeps table alignment selectors in the stylesheet', () => {
    expect(css).toContain("text-align: start")
    expect(css).toContain("[align='center']")
    expect(css).toContain("[align='right']")
  })

  it('katex adapter renders tex', () => {
    const renderer = createKatexRenderer({
      renderToString: (tex) => `<span>${tex}</span>`,
    })

    expect(renderer({ tex: 'x^2', display: true })).toBe('<span>x^2</span>')
  })

  it('chart renderer parses json and dispatches to engine handlers', async () => {
    const dispose = vi.fn()
    const init = vi.fn(() => ({
      setOption: vi.fn(),
      dispose,
      resize: vi.fn(),
    }))
    const chartRenderer = createChartRenderer({
      echarts: createEChartsChartHandler({ init }),
    })
    const container = document.createElement('div')

    const ok = await chartRenderer(
      { engine: 'echarts', source: '{"series":[{"type":"line","data":[1]}]}', theme: 'dark' },
      container,
    )
    const bad = await chartRenderer({ engine: 'echarts', source: '{not json', theme: 'light' }, container)
    const missing = await chartRenderer({ engine: 'vega-lite', source: '{}', theme: 'light' }, container)

    expect(ok.handle).toBeDefined()
    expect(init).toHaveBeenCalledWith(container, 'dark', { renderer: 'canvas' })
    ok.handle?.dispose()
    expect(dispose).toHaveBeenCalled()
    expect(bad.error).toMatch(/Invalid JSON/)
    expect(missing.error).toMatch(/vega-lite/)
  })

  it('vega-lite normalization fills the chart canvas by default', () => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 720, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 0, configurable: true })

    const normalized = normalizeVegaLiteSpec({ mark: 'bar', encoding: {} }, { height: '320' }, container, 720)

    expect(normalized.width).toBe(720)
    expect(normalized.height).toBe(320)
    expect(normalized.autosize).toMatchObject({ type: 'fit', resize: true })

    const custom = normalizeVegaLiteSpec({ width: 400, height: 200, autosize: false }, { height: '320' }, container, 720)
    expect(custom.width).toBe(400)
    expect(custom.height).toBe(200)
    expect(custom.autosize).toBe(false)
  })

  it('cytoscape graph handler mounts elements and destroys on dispose', async () => {
    const destroy = vi.fn()
    const cytoscape = vi.fn(() => ({ destroy, resize: vi.fn() }))
    const handler = createCytoscapeGraphHandler(cytoscape)
    const container = document.createElement('div')

    const handle = await Promise.resolve(
      handler(
        container,
        { elements: [{ data: { id: 'a' } }], style: [{ selector: 'node', style: { label: 'data(id)' } }] },
        {},
      ),
    )

    expect(cytoscape).toHaveBeenCalledWith(expect.objectContaining({ container }))
    handle.dispose()
    expect(destroy).toHaveBeenCalled()
  })
})
