import type { Node } from '@markdoc/markdoc'

function plainText(node: Node): string {
  if (node.type === 'text' || node.type === 'code') {
    return typeof node.attributes.content === 'string' ? node.attributes.content : ''
  }
  if (node.type === 'softbreak' || node.type === 'hardbreak') return '\n'
  return node.children.map(plainText).join('')
}

export function firstContentFence(node: Node): Node | undefined {
  return node.children.find((child) => {
    if (child.type !== 'fence') return false
    return typeof child.attributes.content === 'string' && child.attributes.content.trim().length > 0
  })
}

/** Resolves body text from a fence, `source` attribute, or plain tag body. */
export function resolveBlockSource(node: Node): string | undefined {
  const fence = firstContentFence(node)
  const fenceSource = fence?.attributes.content
  const attributeSource = node.attributes.source
  if (typeof fenceSource === 'string' && fenceSource.trim()) {
    return fenceSource
  }
  if (typeof attributeSource === 'string' && attributeSource.trim()) {
    return attributeSource
  }
  const body = node.children
    .filter((child) => child.type !== 'fence')
    .map(plainText)
    .join('\n')
    .trim()
  return body || undefined
}
