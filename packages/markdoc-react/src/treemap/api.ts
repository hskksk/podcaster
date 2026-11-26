import {
  flattenTreemapNodes as flattenTreemapNodesUntyped,
  parseTreemapDocument as parseTreemapDocumentUntyped,
} from './legacyMount'

export interface TreemapNode {
  id: string
  kind: string
  title: string
  text: string
  subtitle?: string
  children: TreemapNode[]
  anchors: string[]
  line?: number
  subtitleAuto?: boolean
}

export interface TreemapExplicitLink {
  from: string
  to: string
  type: string
  label?: string
  source?: string
}

export interface TreemapDocument {
  title?: string
  intro?: string
  chapters: TreemapNode[]
  explicitLinks?: TreemapExplicitLink[]
}

export interface FlatTreemapNode {
  node: TreemapNode
  path: string[]
  anc: string[]
}

export function parseTreemapDocument(
  source: string,
  options?: { title?: string; chapterLevel?: number; maxTilesPerGroup?: number },
): TreemapDocument {
  return parseTreemapDocumentUntyped(source, options) as TreemapDocument
}

export function flattenTreemapNodes(doc: TreemapDocument): FlatTreemapNode[] {
  return flattenTreemapNodesUntyped(doc) as FlatTreemapNode[]
}
