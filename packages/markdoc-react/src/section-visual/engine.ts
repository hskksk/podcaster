import { ARTICLE_VISUAL_ENGINE, parseArticleVisualSpecV1 } from './parse-v1'
import { ArticleVisualView } from './ArticleVisualView'
import type { ArticleVisualSpecV1, VisualEngineDefinition } from './types'

export const articleVisualEngine: VisualEngineDefinition<ArticleVisualSpecV1> = {
  id: ARTICLE_VISUAL_ENGINE,
  versions: ['1'],
  parse(version: string, spec: unknown) {
    if (version !== '1') throw new Error(`unsupported engine version: ${version}`)
    const parsed = parseArticleVisualSpecV1(spec)
    if (!parsed.ok) throw new Error(parsed.errors.join('; '))
    return parsed.spec as ArticleVisualSpecV1
  },
  Component: ArticleVisualView,
}
