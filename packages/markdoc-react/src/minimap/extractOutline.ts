import Markdoc from '@markdoc/markdoc'
import type { Node } from '@markdoc/markdoc'
import { slugify } from '../slugify'
import { astCharWeight, astText } from './astText'
import type { MinimapBlockKind, MinimapOutline, MinimapSection } from './types'

const BLOCK_TAGS: Record<string, MinimapBlockKind> = {
  callout: 'callout',
  diagram: 'diagram',
  chart: 'chart',
  graph: 'graph',
  tabs: 'tabs',
  details: 'details',
  math: 'math',
}

function uniqueHeadingId(base: string, used: Set<string>): string {
  let id = base
  let suffix = 2
  while (used.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  used.add(id)
  return id
}

function headingId(node: Node, used: Set<string>): string {
  const explicit = typeof node.attributes.id === 'string' ? node.attributes.id.trim() : ''
  const base = explicit || slugify(astText(node))
  return base ? uniqueHeadingId(base, used) : uniqueHeadingId('section', used)
}

function collectBlockKinds(node: Node, kinds: Set<MinimapBlockKind>): void {
  if (node.type === 'fence') {
    kinds.add('code')
    return
  }
  if (node.type === 'tag') {
    const tag = typeof node.tag === 'string' ? node.tag : ''
    const kind = BLOCK_TAGS[tag]
    if (kind) kinds.add(kind)
  }
  for (const child of node.children ?? []) collectBlockKinds(child, kinds)
}

function sectionWeight(nodes: Node[]): number {
  let weight = 0
  for (const node of nodes) {
    weight += Math.max(1, astCharWeight(node))
    if (node.type === 'fence') {
      const content = node.attributes.content
      if (typeof content === 'string') weight += content.length
    }
  }
  return Math.max(1, weight)
}

function pushSection(
  sections: MinimapSection[],
  partial: Omit<MinimapSection, 'weight' | 'blockKinds'> & { nodes: Node[] },
): void {
  const kinds = new Set<MinimapBlockKind>()
  for (const node of partial.nodes) collectBlockKinds(node, kinds)
  sections.push({
    id: partial.id,
    title: partial.title,
    level: partial.level,
    weight: sectionWeight(partial.nodes),
    blockKinds: [...kinds],
  })
}

/**
 * Fast structure pass over Markdoc source (parse only, no transform).
 * Heading ids follow the same slug rules as {@link MarkdocView}.
 */
export function extractMinimapOutline(source: string): MinimapOutline {
  const ast = Markdoc.parse(source)
  const usedIds = new Set<string>()
  const sections: MinimapSection[] = []

  let pending: Node[] = []
  let pendingTitle = 'Introduction'
  let pendingLevel = 1
  let pendingId = uniqueHeadingId('introduction', usedIds)

  const flush = () => {
    if (pending.length === 0) return
    pushSection(sections, {
      id: pendingId,
      title: pendingTitle,
      level: pendingLevel,
      nodes: pending,
    })
    pending = []
  }

  for (const node of ast.children ?? []) {
    if (node.type === 'heading') {
      flush()
      const level = Number(node.attributes.level)
      pendingLevel = Number.isFinite(level) ? Math.min(6, Math.max(1, Math.trunc(level))) : 1
      pendingTitle = astText(node).trim() || `Heading ${pendingLevel}`
      pendingId = headingId(node, usedIds)
      pending = [node]
      continue
    }
    pending.push(node)
  }

  flush()

  if (sections.length === 0) {
    pushSection(sections, {
      id: uniqueHeadingId('document', usedIds),
      title: 'Document',
      level: 1,
      nodes: ast.children ?? [],
    })
  }

  const totalWeight = sections.reduce((sum, section) => sum + section.weight, 0)
  return { sections, totalWeight }
}
