import type { Config, Schema } from '@markdoc/markdoc'

export interface MarkdocExtensions {
  nodes?: Record<string, Schema>
  tags?: Record<string, Schema>
  variables?: Config['variables']
  functions?: Config['functions']
}

/**
 * Who decides whether tags inside fences run.
 * - `document`: the document decides, per fence language and `{% process %}`.
 * - `off`: every fence is literal. The document cannot turn execution back on.
 */
export type FenceTagMode = 'document' | 'off'

export interface CreateMarkdocConfigOptions {
  fenceTags?: FenceTagMode
}
