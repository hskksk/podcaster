import type { CSSProperties } from 'react'
import { Fragment, useId } from 'react'
import { layerNodes } from './flowLayers'
import type { ArticleVisualSpecV1 } from './types'

const TYPE_LABELS: Record<string, string> = {
  cards: 'cards',
  sequence: 'sequence',
  interaction: 'interaction',
  comparison: 'comparison',
  hierarchy: 'hierarchy',
  flow: 'flow',
  matrix: 'matrix',
  chart: 'chart',
}

const TILE_TONES = ['blue', 'blue-deep', 'slate', 'accent'] as const

function tileTone(index: number, emphasis?: boolean): (typeof TILE_TONES)[number] {
  if (emphasis) return 'accent'
  return TILE_TONES[index % TILE_TONES.length]
}

const numberFormatter = new Intl.NumberFormat()

type Item = {
  id?: string
  label: string
  detail?: string
  icon?: string
  emphasis?: boolean
}

function ItemText({
  label,
  detail,
  size = 'lg',
}: {
  label: string
  detail?: string
  size?: 'xl' | 'lg' | 'md'
}) {
  return (
    <div className="article-visual__item-text">
      <span className={`article-visual__big-label article-visual__big-label--${size}`}>{label}</span>
      {detail ? <span className="article-visual__one-line">{detail}</span> : null}
    </div>
  )
}

function TitleBlock({
  title,
  caption,
  type,
  mode,
  variant,
  titleId,
  captionId,
}: {
  title: string
  caption?: string
  type: string
  mode?: string
  variant?: string
  titleId: string
  captionId: string
}) {
  const bits = [TYPE_LABELS[type] ?? type]
  if (type === 'sequence' && mode) bits.push(mode)
  if (type === 'chart' && variant) bits.push(variant)
  return (
    <header className="article-visual__header">
      <span className="article-visual__kicker" aria-hidden="true" translate="no">
        {bits.join(' · ')}
      </span>
      <p id={titleId} className="article-visual__title">
        {title}
      </p>
      {caption ? (
        <p id={captionId} className="article-visual__caption">
          {caption}
        </p>
      ) : null}
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
  const titleId = useId()
  const captionId = useId()
  const altId = useId()
  const describesAlt = alt.trim() !== '' && alt !== spec.title
  const sequenceMode = spec.type === 'sequence' ? String(spec.mode) : undefined
  const chartVariant = spec.type === 'chart' ? String(spec.variant) : undefined

  return (
    <figure
      className={`article-visual article-visual--${theme}`}
      aria-labelledby={titleId}
      aria-describedby={
        [describesAlt ? altId : null, caption ? captionId : null].filter(Boolean).join(' ') || undefined
      }
      data-article-visual-type={spec.type}
    >
      <TitleBlock
        title={spec.title}
        caption={caption}
        type={spec.type}
        mode={sequenceMode}
        variant={chartVariant}
        titleId={titleId}
        captionId={captionId}
      />
      {describesAlt ? (
        <p id={altId} className="article-visual__sr-only">
          {alt}
        </p>
      ) : null}
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
          nodes={spec.nodes as { id: string; label: string; emphasis?: boolean }[]}
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

function cardGridCols(count: number): number {
  if (count <= 2) return count
  if (count === 3) return 3
  return 2
}

function CardsBody({ items }: { items: Item[] }) {
  const cols = cardGridCols(items.length)
  return (
    <ul
      className="article-visual__cards"
      data-count={items.length}
      style={{ '--av-cols': cols } as CSSProperties}
    >
      {items.map((item, i) => (
        <li
          key={`${item.label}-${i}`}
          className="article-visual__card"
          data-tone={tileTone(i, item.emphasis)}
          data-emphasis={item.emphasis || undefined}
        >
          <ItemText label={item.label} detail={item.detail} size="xl" />
        </li>
      ))}
    </ul>
  )
}

function SequenceBody({ mode, items }: { mode: string; items: Item[] }) {
  if (mode === 'funnel') {
    const minWidth = 38
    return (
      <div className="article-visual__funnel">
        {items.map((item, i) => {
          const width = minWidth + ((100 - minWidth) * (items.length - 1 - i)) / Math.max(items.length - 1, 1)
          const tone = i === 0 ? 'blue-deep' : i === items.length - 1 ? 'accent' : 'blue'
          return (
            <div
              key={`${item.label}-${i}`}
              className="article-visual__funnel-step"
              data-tone={item.emphasis ? 'accent' : tone}
              data-emphasis={item.emphasis || undefined}
              style={{ width: `${width}%` }}
            >
              {item.label}
            </div>
          )
        })}
      </div>
    )
  }

  if (mode === 'timeline') {
    return (
      <ol className="article-visual__sequence article-visual__sequence--timeline">
        {items.map((item, i) => (
          <li
            key={`${item.label}-${i}`}
            className="article-visual__seq-item"
            data-tone={tileTone(i, item.emphasis)}
            data-emphasis={item.emphasis || undefined}
          >
            <ItemText label={item.label} detail={item.detail} size="lg" />
          </li>
        ))}
      </ol>
    )
  }

  return (
    <ol className="article-visual__sequence article-visual__sequence--steps">
      {items.map((item, i) => (
        <li
          key={`${item.label}-${i}`}
          className="article-visual__seq-item"
          data-tone={tileTone(i, item.emphasis)}
          data-emphasis={item.emphasis || undefined}
        >
          <span className="article-visual__seq-index" aria-hidden="true">
            {i + 1}
          </span>
          <span className="article-visual__big-label">{item.label}</span>
        </li>
      ))}
    </ol>
  )
}

function laneCenterPct(index: number, laneCount: number): number {
  return ((index + 0.5) / laneCount) * 100
}

function InteractionBody({
  actors,
  steps,
}: {
  actors: { id: string; label: string }[]
  steps: { from: string; to: string; label: string }[]
}) {
  const laneIndex = new Map(actors.map((a, i) => [a.id, i]))
  const laneCount = actors.length
  return (
    <div className="article-visual__interaction" style={{ '--av-lanes': laneCount } as CSSProperties}>
      <div className="article-visual__interaction-actors">
        {actors.map((a, i) => (
          <div
            key={a.id}
            className="article-visual__lane"
            data-emphasis={i === Math.floor(actors.length / 2) ? true : undefined}
          >
            <span className="article-visual__lane-label">{a.label}</span>
          </div>
        ))}
      </div>
      <div className="article-visual__interaction-trace">
        <div className="article-visual__interaction-lifelines" aria-hidden="true">
          {actors.map((a) => (
            <span key={a.id} className="article-visual__interaction-lifeline" />
          ))}
        </div>
        <ol className="article-visual__interaction-steps">
          {steps.map((step, i) => {
            const fromIdx = laneIndex.get(step.from) ?? 0
            const toIdx = laneIndex.get(step.to) ?? 0
            const returning = toIdx < fromIdx
            const fromPct = laneCenterPct(fromIdx, laneCount)
            const toPct = laneCenterPct(toIdx, laneCount)
            const left = Math.min(fromPct, toPct)
            const width = Math.abs(toPct - fromPct)
            return (
              <li
                key={`${step.from}-${step.to}-${i}`}
                className="article-visual__interaction-step"
                data-return={returning || undefined}
                style={
                  {
                    '--msg-left': `${left}%`,
                    '--msg-width': `${width}%`,
                    '--msg-tip': `${toPct}%`,
                  } as CSSProperties
                }
              >
                <span className="article-visual__interaction-step-arrow" aria-hidden="true" />
                <span className="article-visual__interaction-step-label">{step.label}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

function ComparisonBody({ sides }: { sides: { label: string; emphasis?: boolean; items: Item[] }[] }) {
  const [left, right] = sides
  if (!left || !right) return null
  const rows = Math.max(left.items.length, right.items.length, 0)

  return (
    <div className="article-visual__comparison-board">
      <span className="article-visual__comparison-vs" aria-hidden="true">
        VS
      </span>
      <div className="article-visual__cmp-head" data-side="0" data-emphasis={left.emphasis || undefined}>
        {left.label}
      </div>
      <div className="article-visual__cmp-head" data-side="1" data-emphasis={right.emphasis || undefined}>
        {right.label}
      </div>
      {Array.from({ length: rows }, (_, i) => {
        const leftItem = left.items[i]
        const rightItem = right.items[i]
        const axis = leftItem?.detail?.trim() || rightItem?.detail?.trim()
        return (
          <Fragment key={i}>
            {axis ? (
              <span className="article-visual__cmp-axis" style={{ '--cmp-row': i } as CSSProperties}>
                {axis}
              </span>
            ) : null}
            <div className="article-visual__cmp-cell" data-side="0" data-filled={leftItem ? true : undefined}>
              {leftItem?.label ?? ''}
            </div>
            <div
              className="article-visual__cmp-cell"
              data-side="1"
              data-filled={rightItem ? true : undefined}
              data-emphasis={rightItem?.emphasis || undefined}
            >
              {rightItem?.label ?? ''}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

function HierarchyBody({ root }: { root: Item & { children?: Item[] } }) {
  const children = root.children ?? []
  const cols = Math.min(Math.max(children.length, 1), 3)
  return (
    <div className="article-visual__hierarchy-board">
      <span className="article-visual__hierarchy-root">{root.label}</span>
      {children.length > 0 ? (
        <div className="article-visual__hierarchy-fork" style={{ '--av-cols': cols } as CSSProperties}>
          <span className="article-visual__hierarchy-fork-down" aria-hidden="true" />
          <span className="article-visual__hierarchy-fork-bar" aria-hidden="true" />
          <ul className="article-visual__hierarchy-columns">
            {children.map((child, i) => (
              <li key={child.label} className="article-visual__hierarchy-col">
                <span className="article-visual__hierarchy-col-tick" aria-hidden="true" />
                <div
                  className="article-visual__hierarchy-pillar"
                  data-tone={tileTone(i, child.emphasis)}
                  data-emphasis={child.emphasis || undefined}
                >
                  <span className="article-visual__hierarchy-pillar-label">{child.label}</span>
                </div>
                {(child as Item & { children?: Item[] }).children?.length ? (
                  <>
                    <span className="article-visual__hierarchy-leaf-stem" aria-hidden="true" />
                    <ul className="article-visual__hierarchy-leaves">
                      {((child as Item & { children?: Item[] }).children ?? []).map((leaf) => (
                        <li key={leaf.label} className="article-visual__hierarchy-leaf">
                          <span className="article-visual__hierarchy-leaf-label">{leaf.label}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : root.detail ? (
        <p className="article-visual__one-line" style={{ marginTop: '0.75rem' }}>
          {root.detail}
        </p>
      ) : null}
    </div>
  )
}

function isConvergeFlow(layers: string[][], edges: { from: string; to: string }[]) {
  if (layers.length !== 2) return false
  if (layers[0].length < 2 || layers[1].length !== 1) return false
  const sink = layers[1][0]
  return edges.length > 0 && edges.every((e) => e.to === sink)
}

function FlowBody({
  nodes,
  edges,
}: {
  nodes: { id: string; label: string; emphasis?: boolean }[]
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

  if (isConvergeFlow(layers, edges)) {
    const sources = layers[0]
    const sinkId = layers[1][0]
    const sink = nodeMap.get(sinkId)
    return (
      <div className="article-visual__flow article-visual__flow--converge">
        <div className="article-visual__flow-sources">
          {sources.map((id) => {
            const node = nodeMap.get(id)
            if (!node) return null
            return (
              <div key={id} className="article-visual__flow-node article-visual__flow-node--source">
                <ItemText label={node.label} size="md" />
              </div>
            )
          })}
        </div>
        <div className="article-visual__flow-merge" aria-hidden="true" />
        {sink ? (
          <div
            className="article-visual__flow-node article-visual__flow-node--sink"
            data-emphasis={sink.emphasis || true}
          >
            <ItemText label={sink.label} size="lg" />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="article-visual__flow">
      {layers.map((layer, li) => (
        <div key={li}>
          <div className="article-visual__flow-layer">
            {layer.map((id) => {
              const node = nodeMap.get(id)
              if (!node) return null
              return (
                <div key={id} className="article-visual__flow-node" data-emphasis={node.emphasis || undefined}>
                  <ItemText label={node.label} size="md" />
                </div>
              )
            })}
          </div>
          {li < layers.length - 1 ? (
            <div className="article-visual__flow-connector" aria-hidden="true">
              {labelsBetweenLayers[li]?.join(' · ')}
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
      <div className="article-visual__matrix-y-high">{yAxis.high}</div>
      <div className="article-visual__matrix-grid">
        {QUADRANT_ORDER.map((q) => (
          <div key={q} className={`article-visual__matrix-cell article-visual__matrix-cell--${q}`}>
            {(byQuad.get(q) ?? []).map((item) => (
              <span key={item.label} className="article-visual__matrix-pill" data-emphasis={item.emphasis || undefined}>
                {item.label}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="article-visual__matrix-x">
        <span>{xAxis.low}</span>
        <span>{xAxis.high}</span>
      </div>
      <div className="article-visual__matrix-y-high" style={{ marginTop: '0.15rem' }}>
        {yAxis.low}
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

  if (variant === 'line') {
    const headline = values.find((v) => v.emphasis) ?? values[0]
    const points = values
      .map((v, i) => {
        const x = 24 + (i * 528) / Math.max(values.length - 1, 1)
        const y = 110 - (v.value / max) * 70
        return `${x},${y}`
      })
      .join(' ')
    return (
      <div className="article-visual__chart article-visual__chart--line">
        <div className="article-visual__chart-hero" translate="no">
          {numberFormatter.format(headline.value)}
          {unit ? unit : ''}
        </div>
        <p className="article-visual__chart-metric-label">{headline.label}</p>
        <svg className="article-visual__chart-spark" viewBox="0 0 576 120" role="img" aria-hidden="true">
          <line x1="0" y1="110" x2="576" y2="110" />
          <polyline points={points} />
          {values.map((v, i) => {
            const x = 24 + (i * 528) / Math.max(values.length - 1, 1)
            const y = 110 - (v.value / max) * 70
            return <circle key={v.label} cx={x} cy={y} r="7" />
          })}
        </svg>
      </div>
    )
  }

  if (variant === 'donut') {
    const primary = values.find((v) => v.emphasis) ?? values[0]
    const pct = `${Math.min(100, Math.max(0, primary.value))}%`
    return (
      <div
        className="article-visual__chart article-visual__chart--donut"
        style={{ '--av-pct': pct } as CSSProperties}
      >
        <div className="article-visual__donut">
          <div className="article-visual__donut-hole" translate="no">
            {numberFormatter.format(primary.value)}
            {unit ?? '%'}
          </div>
        </div>
        <div className="article-visual__donut-legend">
          <span style={{ color: 'var(--av-accent)' }}>■ {primary.label}</span>
          {values
            .filter((v) => v !== primary)
            .slice(0, 1)
            .map((v) => (
              <span key={v.label} data-muted>
                ■ {v.label}
              </span>
            ))}
        </div>
      </div>
    )
  }

  return (
    <div className="article-visual__chart article-visual__chart--bar">
      {values.map((row) => (
        <div key={row.label} className="article-visual__chart-metric" data-emphasis={row.emphasis || undefined}>
          <span className="article-visual__chart-metric-label">{row.label}</span>
          <span className="article-visual__chart-metric-value" translate="no">
            {numberFormatter.format(row.value)}
            {unit ? unit : ''}
          </span>
          <div className="article-visual__chart-metric-bar" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={row.value} aria-label={row.label}>
            <span style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
