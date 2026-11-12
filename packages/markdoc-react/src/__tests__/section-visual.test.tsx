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

  it('renders a pros_cons spec', () => {
    render(
      <ArticleVisualView
        alt="praise vs concern"
        spec={{
          type: 'pros_cons',
          title: 'Split reaction',
          sides: [
            { label: 'Pros', items: [{ label: 'Good design' }, { label: 'Runs apps' }] },
            { label: 'Cons', items: [{ label: 'Naming' }, { label: 'Lock-in' }] },
          ],
        }}
      />,
    )
    expect(screen.getByText('Good design')).toBeInTheDocument()
    expect(screen.getByText('Lock-in')).toBeInTheDocument()
    expect(screen.getByText('VS')).toBeInTheDocument()
    expect(document.querySelector('.article-visual__pros-cons-list[data-side="0"]')).toBeTruthy()
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
