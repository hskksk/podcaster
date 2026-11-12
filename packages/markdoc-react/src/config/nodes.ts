import Markdoc from '@markdoc/markdoc'
import type { Config, Node, RenderableTreeNodes, Schema } from '@markdoc/markdoc'
import { slugify } from '../slugify'
import type { FenceTagMode } from './types'

const { Tag, nodes: defaultNodes } = Markdoc

const LITERAL_FENCE_LANGUAGES = new Set(['md', 'markdown', 'markdoc', 'mdoc'])

const headingIds = new WeakMap<object, Set<string>>()

function resetHeadingIds(config: object) {
  headingIds.set(config, new Set())
}

function uniqueHeadingId(base: string, config: object): string {
  let used = headingIds.get(config)
  if (!used) {
    used = new Set()
    headingIds.set(config, used)
  }
  let id = base
  let suffix = 2
  while (used.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  used.add(id)
  return id
}

function renderableText(value: RenderableTreeNodes): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map((child) => renderableText(child)).join('')
  if (value && typeof value === 'object' && 'children' in value) return renderableText(value.children)
  return ''
}

function fenceUsesLiteralContent(language: string | undefined, process: boolean | undefined): boolean {
  if (process === false) return true
  if (process === true) return false
  return language != null && LITERAL_FENCE_LANGUAGES.has(language)
}

function fenceHasTags(node: Node): boolean {
  return node.children.some((child) => child.type === 'tag')
}

const document: Schema = {
  ...defaultNodes.document,
  transform(node: Node, config: Config) {
    resetHeadingIds(config)
    return new Tag(
      defaultNodes.document.render ?? 'article',
      node.transformAttributes(config),
      node.transformChildren(config),
    )
  },
}

export function createFenceSchema(mode: FenceTagMode): Schema {
  return {
    render: 'CodeFence',
    attributes: defaultNodes.fence.attributes,
    transform(node: Node, config: Config) {
      const attributes = node.transformAttributes(config)
      const language = typeof node.attributes.language === 'string' ? node.attributes.language : undefined
      const processFlag = node.attributes.process as boolean | undefined
      const content = typeof node.attributes.content === 'string' ? node.attributes.content : undefined
      const literal = mode === 'off' || fenceUsesLiteralContent(language, processFlag)
      const processed = !literal && fenceHasTags(node)
      const children = processed ? node.transformChildren(config) : content == null ? [] : [content]
      return new Tag('CodeFence', { ...attributes, language, content, processed }, children)
    },
  }
}

const fence = createFenceSchema('document')

const heading: Schema = {
  render: 'Heading',
  attributes: {
    level: { type: Number, required: true },
    id: { type: String },
  },
  transform(node: Node, config: Config) {
    const attributes = node.transformAttributes(config)
    const children = node.transformChildren(config)
    const explicit = typeof node.attributes.id === 'string' ? node.attributes.id.trim() : ''
    const base = explicit || slugify(renderableText(children))
    const id = base ? uniqueHeadingId(base, config) : undefined
    const next: Record<string, unknown> = { ...attributes, level: node.attributes.level }
    if (id) next.id = id
    else delete next.id
    return new Tag('Heading', next, children)
  },
}

const table: Schema = {
  ...defaultNodes.table,
  transform(node: Node, config: Config) {
    const children = node.transformChildren(config)
    return new Tag('div', { class: 'markdoc-table-wrap' }, [new Tag('table', {}, children)])
  },
}

export const builtinNodes: Record<string, Schema> = {
  ...defaultNodes,
  document,
  fence,
  heading,
  table,
}
