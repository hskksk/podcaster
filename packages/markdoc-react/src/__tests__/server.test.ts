import Markdoc from '@markdoc/markdoc'
import { describe, expect, it } from 'vitest'
import {
  builtinNodes,
  builtinTags,
  childText,
  createFenceSchema,
  createMarkdocConfig,
  slugify,
} from '../server'

describe('server entry', () => {
  it('exposes the built-in schema and config helpers', () => {
    expect(builtinTags.callout).toBeDefined()
    expect(builtinNodes.heading).toBeDefined()
    expect(typeof createFenceSchema).toBe('function')
    expect(slugify('Hello World')).toBe('hello-world')
    expect(childText({ props: { children: ['server', ' ', 'safe'] } })).toBe('server safe')
  })

  it('transforms a document to a renderable tree without React', () => {
    const config = createMarkdocConfig()
    const ast = Markdoc.parse('# Hello\n\n{% callout type="warning" %}\nCareful\n{% /callout %}')
    const content = Markdoc.transform(ast, config)
    const html = Markdoc.renderers.html(content)

    expect(html).toContain('Hello')
    expect(html).toContain('Careful')
    expect(html).toContain('warning')
  })

  it('honors the fence tag mode from the shared config', () => {
    const config = createMarkdocConfig(undefined, { fenceTags: 'off' })
    const ast = Markdoc.parse('```ts\n{% callout %}hi{% /callout %}\n```')
    const html = Markdoc.renderers.html(Markdoc.transform(ast, config))

    expect(html).not.toContain('<Callout')
    expect(html).toContain('{% callout %}')
  })
})
