import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdocReader, parseTreemapDocument } from '../index'

describe('parseTreemapDocument', () => {
  it('builds chapter rows from h2 headings', () => {
    const doc = parseTreemapDocument('# Title\n\n## One\n\npara\n\n## Two\n\nmore')
    expect(doc.chapters.length).toBeGreaterThanOrEqual(2)
    expect(doc.chapters[0]?.title).toContain('One')
  })
})

describe('MarkdocReader treemap', () => {
  it('mounts the treemap host by default', () => {
    render(<MarkdocReader source="# Hi\n\n## Section\n\nbody" />)
    expect(document.querySelector('.markdoc-treemap-host')).not.toBeNull()
    expect(document.querySelector('.tm-minimap')).not.toBeNull()
  })

  it('can fall back to outline minimap', () => {
    render(<MarkdocReader source="# Hi" minimapVariant="outline" />)
    expect(screen.getByRole('navigation', { name: 'Document map' })).toBeInTheDocument()
    expect(document.querySelector('.markdoc-treemap-host')).toBeNull()
  })
})
