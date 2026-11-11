import type { CSSProperties } from 'react'
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

function LabelStack({
  label,
  detail,
  emphasis,
  icon,
}: {
  label: string
  detail?: string
  emphasis?: boolean
  icon?: string
}) {
  return (
    <div className="article-visual__label-block">
      {icon ? <SemanticIcon id={icon} /> : null}
      <div className="article-visual__label-stack">
        <span className={emphasis ? 'article-visual__label article-visual__label--emphasis' : 'article-visual__label'}>
          {label}
        </span>
        {detail ? <span className="article-visual__detail">{detail}</span> : null}
      </div>
    </div>
  )
}

function TitleBlock({ title, caption, type }: { title: string; caption?: string; type: string }) {
  return (
    <header className="article-visual__header">
      <span className="article-visual__kicker" aria-hidden>
        {type}
      </span>
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
      <TitleBlock title={spec.title} caption={caption} type={spec.type} />
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
  const cols = Math.min(3, items.length)
  return (
    <ul className="article-visual__cards" style={{ '--av-cols': cols } as CSSProperties}>
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`} className="article-visual__card" data-emphasis={item.emphasis || undefined}>
          <LabelStack label={item.label} detail={item.detail} emphasis={item.emphasis} icon={item.icon} />
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
          <LabelStack label={item.label} detail={item.detail} emphasis={item.emphasis} icon={item.icon} />
          {i < items.length - 1 ? <span className="article-visual__seq-connector" aria-hidden /> : null}
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
  const laneIndex = new Map(actors.map((a, i) => [a.id, i]))
  return (
    <div className="article-visual__interaction">
      <div className="article-visual__lanes" style={{ '--av-lanes': actors.length } as CSSProperties}>
        {actors.map((a, i) => (
          <div key={a.id} className="article-visual__lane" data-lane={i}>
            <span className="article-visual__lane-label">{a.label}</span>
          </div>
        ))}
      </div>
      <ol className="article-visual__steps">
        {steps.map((step, i) => {
          const fromIdx = laneIndex.get(step.from) ?? 0
          const toIdx = laneIndex.get(step.to) ?? 0
          const dir = fromIdx === toIdx ? 'same' : fromIdx < toIdx ? 'right' : 'left'
          return (
            <li
              key={`${step.from}-${step.to}-${i}`}
              className="article-visual__step"
              data-dir={dir}
            >
              <span className="article-visual__step-badge" aria-hidden>
                {i + 1}
              </span>
              <span className="article-visual__step-label">{step.label}</span>
              <span className="article-visual__step-meta" aria-hidden>
                {actors.find((a) => a.id === step.from)?.label} → {actors.find((a) => a.id === step.to)?.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ComparisonBody({ sides }: { sides: { label: string; emphasis?: boolean; items: Item[] }[] }) {
  const [left, right] = sides
  if (!left || !right) return null
  return (
    <div className="article-visual__comparison">
      <section className="article-visual__side" data-emphasis={left.emphasis || undefined}>
        <h3 className="article-visual__side-title">{left.label}</h3>
        <ul className="article-visual__side-list">
          {left.items.map((item) => (
            <li key={item.label} className="article-visual__side-row">
              <span className="article-visual__row-key">{item.label}</span>
              {item.detail ? <span className="article-visual__detail">{item.detail}</span> : null}
            </li>
          ))}
        </ul>
      </section>
      <span className="article-visual__comparison-vs" aria-hidden />
      <section className="article-visual__side" data-emphasis={right.emphasis || undefined}>
        <h3 className="article-visual__side-title">{right.label}</h3>
        <ul className="article-visual__side-list">
          {right.items.map((item) => (
            <li key={item.label} className="article-visual__side-row">
              <span className="article-visual__row-key">{item.label}</span>
              {item.detail ? <span className="article-visual__detail">{item.detail}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function HierarchyBody({ root }: { root: Item & { children?: Item[] } }) {
  const renderNode = (node: Item & { children?: Item[] }, depth: number) => (
    <li key={`${node.label}-${depth}`} className="article-visual__tree-node" data-depth={depth}>
      <div className="article-visual__tree-card" data-emphasis={node.emphasis || undefined}>
        <LabelStack label={node.label} detail={node.detail} emphasis={node.emphasis} icon={node.icon} />
      </div>
      {node.children?.length ? (
        <ul className="article-visual__tree-children">
          {node.children.map((child) => renderNode(child as Item & { children?: Item[] }, depth + 1))}
        </ul>
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
  const labelsBetweenLayers: string[][] = []
  for (let li = 0; li < layers.length - 1; li++) {
    const fromSet = new Set(layers[li])
    const toSet = new Set(layers[li + 1])
    const labels = edges
      .filter((e) => fromSet.has(e.from) && toSet.has(e.to) && e.label)
      .map((e) => e.label as string)
    labelsBetweenLayers.push([...new Set(labels)])
  }

  return (
    <div className="article-visual__flow">
      {layers.map((layer, li) => (
        <div key={li} className="article-visual__flow-stage">
          <div className="article-visual__flow-layer">
            {layer.map((id) => {
              const node = nodeMap.get(id)
              if (!node) return null
              return (
                <div key={id} className="article-visual__flow-node" data-emphasis={node.emphasis || undefined}>
                  <LabelStack label={node.label} emphasis={node.emphasis} icon={node.icon} />
                </div>
              )
            })}
          </div>
          {li < layers.length - 1 ? (
            <div className="article-visual__flow-connector" aria-hidden>
              <span className="article-visual__flow-arrow" />
              {labelsBetweenLayers[li]?.length ? (
                <span className="article-visual__flow-edge-labels">{labelsBetweenLayers[li].join(' · ')}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

const QUADRANT_ORDER = ['low-high', 'high-high', 'low-low', 'high-low'] as const

function MatrixBody({
  xAxis,
  yAxis,
  items,
}: {
  xAxis: { low: string; high: string }
  yAxis: { low: string; high: string }
  items: { label: string; quadrant: string; emphasis?: boolean; detail?: string }[]
}) {
  const byQuad = new Map<string, typeof items>()
  for (const q of QUADRANT_ORDER) byQuad.set(q, [])
  for (const item of items) {
    const list = byQuad.get(item.quadrant) ?? []
    list.push(item)
    byQuad.set(item.quadrant, list)
  }

  return (
    <div className="article-visual__matrix">
      <div className="article-visual__matrix-axis article-visual__matrix-axis--y-high">{yAxis.high}</div>
      <div className="article-visual__matrix-board">
        <div className="article-visual__matrix-axis article-visual__matrix-axis--x-low">{xAxis.low}</div>
        <div className="article-visual__matrix-grid">
          {QUADRANT_ORDER.map((q) => (
            <div key={q} className={`article-visual__matrix-cell article-visual__matrix-cell--${q}`}>
              {(byQuad.get(q) ?? []).map((item) => (
                <div key={item.label} className="article-visual__matrix-item" data-emphasis={item.emphasis || undefined}>
                  <span className={item.emphasis ? 'article-visual__label article-visual__label--emphasis' : 'article-visual__label'}>
                    {item.label}
                  </span>
                  {item.detail ? <span className="article-visual__detail">{item.detail}</span> : null}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="article-visual__matrix-axis article-visual__matrix-axis--x-high">{xAxis.high}</div>
      </div>
      <div className="article-visual__matrix-axis article-visual__matrix-axis--y-low">{yAxis.low}</div>
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
          <li key={row.label} className="article-visual__chart-row" data-emphasis={row.emphasis || undefined}>
            <div className="article-visual__chart-row-head">
              <span className="article-visual__label">{row.label}</span>
              <span className="article-visual__chart-value">
                {row.value}
                {unit ? <span className="article-visual__chart-unit">{unit}</span> : null}
              </span>
            </div>
            <div className="article-visual__bar-track" aria-hidden>
              <div
                className="article-visual__bar-fill"
                style={{ width: `${Math.round((row.value / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
