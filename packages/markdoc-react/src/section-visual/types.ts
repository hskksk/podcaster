import type { ComponentType } from 'react'
import type { ArticleVisualSpecType } from './parse-v1'

export type SectionVisualEnvelope = {
  engine: string
  engineVersion: string
  alt: string
  spec: unknown
}

export type VisualEngineDefinition<T> = {
  id: string
  versions: readonly string[]
  parse(version: string, spec: unknown): T
  Component: ComponentType<{
    spec: T
    alt: string
    theme?: 'light' | 'dark'
  }>
}

export type ArticleVisualSpecV1 = {
  type: ArticleVisualSpecType
  title: string
  caption?: string
  [key: string]: unknown
}
