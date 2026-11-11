/**
 * Server / RSC-safe entry (no `"use client"`). Use for `Markdoc.parse` +
 * `transform` in Next.js App Router and other server runtimes, where importing
 * the client entry would pull React components and adapters into the bundle.
 */
export { createMarkdocConfig } from './config/createConfig'
export { builtinNodes, createFenceSchema } from './config/nodes'
export { builtinTags } from './config/tags'
export type { CreateMarkdocConfigOptions, FenceTagMode, MarkdocExtensions } from './config/types'
export { childText } from './childText'
export { slugify } from './slugify'
