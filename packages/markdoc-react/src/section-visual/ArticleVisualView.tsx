import type { CSSProperties, ReactNode } from 'react'
import { layerNodes } from './flowLayers'
import { SemanticIcon } from './SemanticIcon'
import type { ArticleVisualSpecV1 } from './types'

type Item = {
  id?: string
  label: string
  detail?: string
  icon?: string
  emphasis?: boolean
}

function Emphasis({ children, emphasis }: { children: ReactNode; emphasis?: boolean }) {
  return <span className={emphasis ? 'article-visual__emphasis' : undefined}>{children}</span>
}

function TitleBlock({ title, caption }: { title: string; caption?: string }) {
  return (
    <header className="article-visual__header">
      <p className="article-visual__title">{title}</p>
      {caption ? <p className="article-visual__caption">{caption}</p> : null}
    </header>
  )
}

export function ArticleVisualView({
  spec,
  alt,
  theme = 'light',
}: {
  spec: ArticleVisualSpecV1
  alt: string
  theme?: 'light' | 'dark'
}) {
  const caption = typeof spec.caption === 'string' ? spec.caption : undefined
  const body = renderBody(spec)
  return (
    <figure
      className={`article-visual article-visual--${theme}`}
      role="img"
      aria-label={alt}
      data-article-visual-type={spec.type}
    >
      <TitleBlock title={spec.title} caption={caption} />
      <div className="article-visual__body">{body}</div>
    </figure>
  )
}

function renderBody(spec: ArticleVisualSpecV1) {
  switch (spec.type) {
    case 'cards':
      return <CardsBody items={spec.items as Item[]} />
    case 'sequence':
      return <SequenceBody mode={String(spec.mode)} items={spec.items as Item[]} />
    case 'interaction':
      return (
        <InteractionBody
          actors={spec.actors as { id: string; label: string }[]}
          steps={spec.steps as { from: string; to: string; label: string }[]}
        />
      )
    case 'comparison':
      return (
        <ComparisonBody
          sides={spec.sides as { label: string; emphasis?: boolean; items: Item[] }[]}
        />
      )
    case 'hierarchy':
      return <HierarchyBody root={spec.root as Item & { children?: Item[] }} />
    case 'flow':
      return (
        <FlowBody
          nodes={spec.nodes as { id: string; label: string; emphasis?: boolean; icon?: string }[]}
          edges={spec.edges as { from: string; to: string; label?: string }[]}
        />
      )
    case 'matrix':
      return (
        <MatrixBody
          xAxis={spec.xAxis as { low: string; high: string }}
          yAxis={spec.yAxis as { low: string; high: string }}
          items={spec.items as { label: string; quadrant: string; emphasis?: boolean; detail?: string }[]}
        />
      )
    case 'chart':
      return (
        <ChartBody
          variant={String(spec.variant)}
          unit={typeof spec.unit === 'string' ? spec.unit : undefined}
          values={spec.values as { label: string; value: number; emphasis?: boolean }[]}
        />
      )
    default:
      return null
  }
}

function CardsBody({ items }: { items: Item[] }) {
  return (
    <ul className="article-visual__cards" style={{ '--av-cols': Math.min(3, items.length) } as CSSProperties}>
      {items.map((item) => (
        <li key={item.label} className="article-visual__card" data-emphasis={item.emphasis || undefined}>
          <SemanticIcon id={item.icon} />
          <Emphasis emphasis={item.emphasis}>
            <span className="article-visual__label">{item.label}</span>
          </Emphasis>
          {item.detail ? <span className="article-visual__detail">{item.detail}</span> : null}
        </li>
      ))}
    </ul>
  )
}

function SequenceBody({ mode, items }: { mode: string; items: Item[] }) {
  return (
    <ol className={`article-visual__sequence article-visual__sequence--${mode}`}>
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`} className="article-visual__seq-item" data-emphasis={item.emphasis || undefined}>
          <span className="article-visual__seq-index" aria-hidden>
            {i + 1}
          </span>
          <Emphasis emphasis={item.emphasis}>
            <span className="article-visual__label">{item.label}</span>
          </Emphasis>
          {item.detail ? <span className="article-visual__detail">{item.detail}</span> : null}
        </li>
      ))}
    </ol>
  )
}

function InteractionBody({
  actors,
  steps,
}: {
  actors: { id: string; label: string }[]
  steps: { from: string; to: string; label: string }[]
}) {
  return (
    <div className="article-visual__interaction">
      <div className="article-visual__lanes">
        {actors.map((a) => (
          <div key={a.id} className="article-visual__lane">
            <span className="article-visual__lane-label">{a.label}</span>
          </div>
        ))}
      </div>
      <ol className="article-visual__steps">
        {steps.map((step, i) => (
          <li key={`${step.from}-${step.to}-${i}`} className="article-visual__step">
            <span className="article-visual__step-label">{step.label}</span>
            <span className="article-visual__step-meta" aria-hidden>
              {actors.find((a) => a.id === step.from)?.label} → {actors.find((a) => a.id === step.to)?.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ComparisonBody({ sides }: { sides: { label: string; emphasis?: boolean; items: Item[] }[] }) {
  return (
    <div className="article-visual__comparison">
      {sides.map((side) => (
        <section key={side.label} className="article-visual__side" data-emphasis={side.emphasis || undefined}>
          <h3 className="article-visual__side-title">{side.label}</h3>
          <ul>
            {side.items.map((item) => (
              <li key={item.label}>
                <span className="article-visual__label">{item.label}</span>
                {item.detail ? <span className="article-visual__detail">{item.detail}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function HierarchyBody({ root }: { root: Item & { children?: Item[] } }) {
  const renderNode = (node: Item & { children?: Item[] }, depth: number) => (
    <li key={`${node.label}-${depth}`} className="article-visual__tree-node" data-depth={depth}>
      <Emphasis emphasis={node.emphasis}>
        <span className="article-visual__label">{node.label}</span>
      </Emphasis>
      {node.detail ? <span className="article-visual__detail">{node.detail}</span> : null}
      {node.children?.length ? (
        <ul>{node.children.map((child) => renderNode(child as Item & { children?: Item[] }, depth + 1))}</ul>
      ) : null}
    </li>
  )
  return <ul className="article-visual__hierarchy">{renderNode(root, 0)}</ul>
}

function FlowBody({
  nodes,
  edges,
}: {
  nodes: { id: string; label: string; emphasis?: boolean; icon?: string }[]
  edges: { from: string; to: string; label?: string }[]
}) {
  const layers = layerNodes(nodes, edges)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  return (
    <div className="article-visual__flow">
      {layers.map((layer, li) => (
        <div key={li} className="article-visual__flow-layer">
          {layer.map((id) => {
            const node = nodeMap.get(id)
            if (!node) return null
            return (
              <div key={id} className="article-visual__flow-node" data-emphasis={node.emphasis || undefined}>
                <SemanticIcon id={node.icon} />
                <span className="article-visual__label">{node.label}</span>
              </div>
            )
          })}
        </div>
      ))}
      <svg className="article-visual__flow-edges" aria-hidden viewBox="0 0 100 10" preserveAspectRatio="none">
        {edges.map((e, i) => (
          <line key={`${e.from}-${e.to}-${i}`} x1="0" y1="5" x2="100" y2="5" className="article-visual__flow-edge" />
        ))}
      </svg>
    </div>
  )
}

function MatrixBody({
  xAxis,
  yAxis,
  items,
}: {
  xAxis: { low: string; high: string }
  yAxis: { low: string; high: string }
  items: { label: string; quadrant: string; emphasis?: boolean; detail?: string }[]
}) {
  const quadClass = (q: string) => `article-visual__matrix-cell article-visual__matrix-cell--${q}`
  return (
    <div className="article-visual__matrix">
      <span className="article-visual__matrix-axis article-visual__matrix-axis--y-high">{yAxis.high}</span>
      <span className="article-visual__matrix-axis article-visual__matrix-axis--y-low">{yAxis.low}</span>
      <span className="article-visual__matrix-axis article-visual__matrix-axis--x-low">{xAxis.low}</span>
      <span className="article-visual__matrix-axis article-visual__matrix-axis--x-high">{xAxis.high}</span>
      <div className="article-visual__matrix-grid">
        {items.map((item) => (
          <div key={item.label} className={quadClass(item.quadrant)} data-emphasis={item.emphasis || undefined}>
            <Emphasis emphasis={item.emphasis}>
              <span className="article-visual__label">{item.label}</span>
            </Emphasis>
            {item.detail ? <span className="article-visual__detail">{item.detail}</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChartBody({
  variant,
  unit,
  values,
}: {
  variant: string
  unit?: string
  values: { label: string; value: number; emphasis?: boolean }[]
}) {
  const max = Math.max(...values.map((v) => v.value), 1)
  return (
    <div className={`article-visual__chart article-visual__chart--${variant}`} data-unit={unit || undefined}>
      <ul>
        {values.map((row) => (
          <li key={row.label} data-emphasis={row.emphasis || undefined}>
            <span className="article-visual__label">{row.label}</span>
            <div className="article-visual__bar-track" aria-hidden>
              <div
                className="article-visual__bar-fill"
                style={{ width: `${Math.round((row.value / max) * 100)}%` }}
              />
            </div>
            <span className="article-visual__chart-value">
              {row.value}
              {unit ? ` ${unit}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
