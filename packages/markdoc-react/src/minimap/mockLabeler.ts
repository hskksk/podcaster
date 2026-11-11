import type { MinimapLabeler } from './types'

const MOCK_DELAY_MS = 16

function shorten(title: string, max = 28): string {
  const trimmed = title.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

/**
 * Stand-in for an AI summarizer: trims titles and adds a short hint from block kinds.
 */
export function createMockMinimapLabeler(): MinimapLabeler {
  return async (section) => {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
    const base = shorten(section.title)
    if (section.blockKinds.length === 0) return base
    const hint = section.blockKinds.slice(0, 2).join(', ')
    return `${base} · ${hint}`
  }
}
