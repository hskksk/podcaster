import type { ReactNode } from 'react'

export function childText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(childText).join('')
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props
    return childText(props?.children)
  }
  return ''
}

function isReactElement(node: unknown): node is { props?: { children?: ReactNode } } {
  return typeof node === 'object' && node !== null && 'props' in node
}

export function childDiagramSource(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) {
    if (node.some(isReactElement)) {
      return node
        .map(childDiagramSource)
        .map((value) => value.trimEnd())
        .filter((value) => value.length > 0)
        .join('\n')
    }
    let output = ''
    for (const child of node) {
      if (typeof child === 'string') {
        output += child === ' ' ? '\n' : child
      } else {
        output += childDiagramSource(child)
      }
    }
    return output
  }
  if (isReactElement(node)) return childDiagramSource(node.props?.children)
  return ''
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
