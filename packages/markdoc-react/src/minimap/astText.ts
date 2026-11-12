import type { Node } from '@markdoc/markdoc'

export function astText(node: Node): string {
  if (node.type === 'text') {
    const content = node.attributes.content
    return typeof content === 'string' ? content : ''
  }
  if (!node.children?.length) return ''
  return node.children.map((child) => astText(child)).join('')
}

export function astCharWeight(node: Node): number {
  if (node.type === 'text') {
    const content = node.attributes.content
    return typeof content === 'string' ? content.length : 0
  }
  if (!node.children?.length) return 0
  return node.children.reduce((sum, child) => sum + astCharWeight(child), 0)
}
