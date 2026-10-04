import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('server entry', () => {
  it('dist/server.js is not a client module', async () => {
    const path = resolve(import.meta.dirname, '../../dist/server.js')
    const source = await readFile(path, 'utf8')
    expect(source.startsWith('"use client"')).toBe(false)
  })
})
