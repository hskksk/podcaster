import Markdoc from '@markdoc/markdoc'
import * as React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { builtinComponents, type MarkdocComponentMap } from '../components'
import { createMarkdocConfig } from '../config/createConfig'
import type { FenceTagMode, MarkdocExtensions } from '../config/types'
import { MarkdocProvider, type MarkdocRuntime } from '../context/MarkdocProvider'

export interface MarkdocViewProps extends MarkdocRuntime {
  source: string
  config?: MarkdocExtensions
  components?: MarkdocComponentMap
  className?: string
  /**
   * `document` lets each fence choose whether tags inside it run.
   * `off` renders every fence as literal text. The document cannot turn that back on.
   */
  fenceTags?: FenceTagMode
  /** Thrown transform errors, or Markdoc validation errors. Validation does not stop rendering. */
  onError?: (error: unknown) => void
}

export function MarkdocView({
  source,
  config,
  components,
  className,
  fenceTags = 'document',
  onError,
  highlighter,
  diagramRenderer,
  chartRenderer,
  graphRenderer,
  mathRenderer,
  theme,
}: MarkdocViewProps) {
  const mergedConfig = useMemo(() => createMarkdocConfig(config, { fenceTags }), [config, fenceTags])
  const mergedComponents = useMemo<MarkdocComponentMap>(
    () => ({ ...builtinComponents, ...components }),
    [components],
  )
  const runtime = useMemo<MarkdocRuntime>(
    () => ({ highlighter, diagramRenderer, chartRenderer, graphRenderer, mathRenderer, theme }),
    [highlighter, diagramRenderer, chartRenderer, graphRenderer, mathRenderer, theme],
  )

  const rendered = useMemo(() => {
    try {
      const ast = Markdoc.parse(source)
      const errors = Markdoc.validate(ast, mergedConfig)
      const content = Markdoc.transform(ast, mergedConfig)
      return { content, errors, thrown: undefined as unknown }
    } catch (thrown) {
      return { content: null, errors: [], thrown }
    }
  }, [source, mergedConfig])

  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    const report = onErrorRef.current
    if (!report) return
    if (rendered.thrown !== undefined) report(rendered.thrown)
    else if (rendered.errors.length > 0) report(rendered.errors)
  }, [rendered])

  return (
    <MarkdocProvider value={runtime}>
      <div className={className ? `markdoc-root ${className}` : 'markdoc-root'} data-markdoc-view="">
        {rendered.content ? Markdoc.renderers.react(rendered.content, React, { components: mergedComponents }) : null}
      </div>
    </MarkdocProvider>
  )
}
