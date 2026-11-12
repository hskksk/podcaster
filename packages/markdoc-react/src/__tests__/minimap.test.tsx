import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdocReader, MarkdocView, createMockMinimapLabeler, extractMinimapOutline } from '../index'

describe('extractMinimapOutline', () => {
  it('groups content by headings and assigns slug ids', () => {
    const outline = extractMinimapOutline('# Alpha\n\nintro\n\n## Beta\n\nmore')

    expect(outline.sections.map((s) => s.title)).toEqual(['Alpha', 'Beta'])
    expect(outline.sections[0]?.id).toBe('alpha')
    expect(outline.sections[1]?.id).toBe('beta')
    expect(outline.sections[0]?.weight).toBeGreaterThan(0)
  })

  it('detects block tags inside a section', () => {
    const source = '# Viz\n\n{% callout %}hi{% /callout %}\n\n```ts\nx\n```'
    const outline = extractMinimapOutline(source)

    expect(outline.sections[0]?.blockKinds).toContain('callout')
    expect(outline.sections[0]?.blockKinds).toContain('code')
  })
})

describe('MarkdocReader minimap', () => {
  it('matches rendered heading ids for navigation', () => {
    const source = '# Hello\n\n## Nested\n\nbody'
    render(<MarkdocReader source={source} minimapVariant="outline" />)

    const rendered = document.querySelector('#hello')
    expect(rendered).not.toBeNull()
    expect(screen.getByRole('navigation', { name: 'Document map' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hello/ })).toBeInTheDocument()
  })

  it('renders without minimap when disabled', () => {
    render(<MarkdocReader source="# Hi" showMinimap={false} />)
    expect(screen.queryByRole('navigation', { name: 'Document map' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Hi' })).toBeInTheDocument()
  })
})

describe('createMockMinimapLabeler', () => {
  it('returns shortened labels with block hints', async () => {
    const labeler = createMockMinimapLabeler()
    const label = await labeler({
      id: 'x',
      title: 'A very long section title that should be trimmed down',
      level: 2,
      weight: 10,
      blockKinds: ['diagram'],
    })

    expect(label).toContain('…')
    expect(label).toContain('diagram')
  })
})

describe('MarkdocView heading ids stay aligned with outline', () => {
  it('deduplicates repeated titles the same way', () => {
    const source = '# Dup\n\n# Dup\n'
    const outline = extractMinimapOutline(source)
    render(<MarkdocView source={source} />)

    expect(outline.sections.map((s) => s.id)).toEqual(['dup', 'dup-2'])
    expect(document.querySelector('#dup')).not.toBeNull()
    expect(document.querySelector('#dup-2')).not.toBeNull()
  })
})
