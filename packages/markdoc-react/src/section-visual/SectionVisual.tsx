import type { SectionVisualEnvelope, VisualEngineDefinition } from './types'

function AltFallback({ alt }: { alt: string }) {
  return (
    <aside className="article-visual-fallback" role="note">
      <p>{alt}</p>
    </aside>
  )
}

export type SectionVisualProps = {
  visual: SectionVisualEnvelope
  engines: VisualEngineDefinition<unknown>[]
  theme?: 'light' | 'dark'
}

export function SectionVisual({ visual, engines, theme = 'light' }: SectionVisualProps) {
  const engine = engines.find((e) => e.id === visual.engine)
  if (!engine || !engine.versions.includes(visual.engineVersion)) {
    return <AltFallback alt={visual.alt} />
  }
  try {
    const spec = engine.parse(visual.engineVersion, visual.spec)
    const Comp = engine.Component
    return <Comp spec={spec} alt={visual.alt} theme={theme} />
  } catch {
    return <AltFallback alt={visual.alt} />
  }
}
