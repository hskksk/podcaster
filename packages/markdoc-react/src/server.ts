/**
 * Server / RSC-safe entry (no `"use client"`). Use for `Markdoc.parse` + `transform`
 * in Next.js App Router and other server runtimes.
 */
export { createMarkdocConfig } from './config/createConfig'
export { builtinNodes, createFenceSchema } from './config/nodes'
export { builtinTags } from './config/tags'
export type { CreateMarkdocConfigOptions, FenceTagMode, MarkdocExtensions } from './config/types'
export { slugify } from './text'
