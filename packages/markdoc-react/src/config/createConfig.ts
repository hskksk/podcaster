import type { Config } from '@markdoc/markdoc'
import { builtinNodes, createFenceSchema } from './nodes'
import { builtinTags } from './tags'
import type { CreateMarkdocConfigOptions, MarkdocExtensions } from './types'

export function createMarkdocConfig(extensions?: MarkdocExtensions, options?: CreateMarkdocConfigOptions): Config {
  const fenceTags = options?.fenceTags ?? 'document'
  return {
    nodes: {
      ...builtinNodes,
      ...extensions?.nodes,
      // Markdoc clones the config object during transform, so the mode has to
      // live in the fence schema itself. A caller-supplied fence node is a
      // site override and keeps its own transform.
      ...(extensions?.nodes?.fence ? {} : { fence: createFenceSchema(fenceTags) }),
    } as Config['nodes'],
    tags: { ...builtinTags, ...extensions?.tags },
    ...(extensions?.variables ? { variables: extensions.variables } : {}),
    ...(extensions?.functions ? { functions: extensions.functions } : {}),
  }
}
