import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const entry = resolve(dist, 'index.js')

await mkdir(dist, { recursive: true })
await copyFile(resolve(root, 'src/markdoc.css'), resolve(dist, 'markdoc.css'))

const source = await readFile(entry, 'utf8')
if (!source.startsWith('"use client"')) {
  await writeFile(entry, `"use client";\n${source}`)
}
