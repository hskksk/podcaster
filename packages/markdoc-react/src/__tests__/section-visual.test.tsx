import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArticleVisualView, SectionVisual, articleVisualEngine } from '../index'

describe('Article Visual engine', () => {
  it('renders a cards spec', () => {
    render(
      <ArticleVisualView
        alt="test alt"
        spec={{
          type: 'cards',
          title: 'Three pillars',
          items: [
            { label: 'Alpha', detail: 'one' },
            { label: 'Beta', detail: 'two' },
          ],
        }}
      />,
    )
    expect(screen.getByRole('figure', { name: 'Three pillars' })).toBeInTheDocument()
    expect(screen.getByText('test alt')).toBeInTheDocument()
    expect(screen.getByText('Three pillars')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('falls back to alt when engine version is unsupported', () => {
    render(
      <SectionVisual
        visual={{ engine: 'article-visual', engineVersion: '99', alt: 'fallback text', spec: {} }}
        engines={[articleVisualEngine]}
      />,
    )
    expect(screen.getByText('fallback text')).toBeInTheDocument()
  })
})
