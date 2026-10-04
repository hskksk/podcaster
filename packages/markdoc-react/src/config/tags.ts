import Markdoc, { type Config, type Node, type Schema } from '@markdoc/markdoc'

const { Tag } = Markdoc
import { firstContentFence, resolveBlockSource } from './blockSource'

export const callout: Schema = {
  render: 'Callout',
  attributes: {
    type: {
      type: String,
      default: 'note',
      matches: ['note', 'tip', 'warning', 'error'],
    },
  },
}

export const tabs: Schema = {
  render: 'Tabs',
}

export const tab: Schema = {
  render: 'Tab',
  attributes: {
    label: { type: String, required: true },
  },
}

export const details: Schema = {
  render: 'Details',
  attributes: {
    summary: { type: String },
    open: { type: Boolean, default: false },
  },
}

export const badge: Schema = {
  render: 'Badge',
  attributes: {
    type: {
      type: String,
      default: 'default',
      matches: ['default', 'info', 'success', 'warning', 'danger'],
    },
  },
}

export const kbd: Schema = {
  render: 'Kbd',
}

export const math: Schema = {
  render: 'Math',
  attributes: {
    display: { type: Boolean, default: true },
  },
}

export const diagram: Schema = {
  render: 'Diagram',
  attributes: {
    type: { type: String, default: 'mermaid', matches: ['mermaid', 'd2'] },
    source: { type: String },
  },
  transform(node: Node, config: Config) {
    const attributes = node.transformAttributes(config)
    const fence = firstContentFence(node)
    const lang = typeof fence?.attributes.language === 'string' ? fence.attributes.language : undefined
    const explicit = node.attributes.type
    const type = explicit === 'd2' || explicit === 'mermaid'
      ? explicit
      : lang?.toLowerCase() === 'd2'
        ? 'd2'
        : 'mermaid'

    const source = resolveBlockSource(node)
    const next: Record<string, unknown> = { ...attributes, type }
    if (source) next.source = source
    else delete next.source
    return new Tag('Diagram', next, [])
  },
}

function jsonBlockTag(name: 'Chart' | 'Graph'): Schema {
  return {
    render: name,
    attributes: {
      engine: { type: String, required: true },
      source: { type: String },
      height: { type: String },
    },
    transform(node: Node, config: Config) {
      const attributes = node.transformAttributes(config)
      const source = resolveBlockSource(node)
      const next: Record<string, unknown> = { ...attributes }
      if (source) next.source = source
      else delete next.source
      return new Tag(name, next, [])
    },
  }
}

export const chart: Schema = {
  ...jsonBlockTag('Chart'),
  attributes: {
    engine: { type: String, required: true, matches: ['echarts', 'vega-lite'] },
    source: { type: String },
    height: { type: String },
  },
}

export const graph: Schema = {
  ...jsonBlockTag('Graph'),
  attributes: {
    engine: { type: String, required: true, matches: ['cytoscape'] },
    source: { type: String },
    height: { type: String },
  },
}

export const builtinTags: Record<string, Schema> = {
  callout,
  tabs,
  tab,
  details,
  badge,
  kbd,
  math,
  diagram,
  chart,
  graph,
}
