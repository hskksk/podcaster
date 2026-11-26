import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const entry = resolve(dist, 'index.js')
const serverEntry = resolve(dist, 'server.js')
const sectionVisualServer = resolve(dist, 'section-visual-server.js')

await mkdir(dist, { recursive: true })
await rewriteDeclarationSpecifiers(dist)
await copyFile(resolve(root, 'src/markdoc.css'), resolve(dist, 'markdoc.css'))
await copyFile(resolve(root, 'src/article-visual-board.css'), resolve(dist, 'article-visual-board.css'))

const source = await readFile(entry, 'utf8')
if (!source.startsWith('"use client"')) {
  await writeFile(entry, `"use client";\n${source}`)
}

// The `/server` entry must stay free of the client boundary so RSC and other
// server runtimes can call `createMarkdocConfig` without pulling in React.
const reactImport = /^(?:react|react-dom)(?:\/|$)/
const moduleSpecifier = /\b(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s*)['"]([^'"]+)['"]/g

async function assertServerSafe(file, { entry = false, seen = new Set() } = {}) {
  if (seen.has(file)) return
  seen.add(file)
  const code = await readFile(file, 'utf8')
  if (entry && code.startsWith('"use client"')) {
    throw new Error('dist/server.js must not start with "use client"')
  }
  for (const match of code.matchAll(moduleSpecifier)) {
    const specifier = match[1]
    if (reactImport.test(specifier)) {
      throw new Error(`${file} must not import ${specifier}`)
    }
    if (specifier.startsWith('.')) {
      await assertServerSafe(resolve(dirname(file), specifier), { seen })
    }
  }
}

await assertServerSafe(serverEntry, { entry: true })
await assertServerSafe(sectionVisualServer, { entry: true })

// Resolve the public package subpath as consumers do, rather than relying only
// on the expected dist filename. Avoid evaluating external CJS dependencies.
const resolvedServerEntry = import.meta.resolve('@hskksk/markdoc-react/server')
if (resolvedServerEntry !== pathToFileURL(serverEntry).href) {
  throw new Error(`@hskksk/markdoc-react/server must resolve to ${serverEntry}`)
}

const serverTypes = await readFile(resolve(dist, 'server.d.ts'), 'utf8')
if (/['"]react(?:-dom)?(?:\/[^'"]*)?['"]/.test(serverTypes)) {
  throw new Error('dist/server.d.ts must not import react or react-dom')
}

// tsc emits extensionless relative specifiers. NodeNext (the repo tsconfig)
// only resolves those declarations when the specifier ends in .js, or
// /index.js for a directory.
async function rewriteDeclarationSpecifiers(dir) {
  const files = await declarationFiles(dir)
  const specifier = /(from\s+|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const next = source.replace(specifier, (match, prefix, quote, spec) => {
      const rewritten = declarationSpecifier(file, spec)
      if (rewritten === spec) return match
      return `${prefix}${quote}${rewritten}${quote}`
    })
    if (next !== source) await writeFile(file, next)
  }
}

async function declarationFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await declarationFiles(path)))
    else if (entry.name.endsWith('.d.ts')) out.push(path)
  }
  return out
}

function declarationSpecifier(fromFile, spec) {
  if (/\.(?:js|mjs|cjs|json|css|node)$/.test(spec)) return spec
  const abs = resolve(dirname(fromFile), spec)
  if (existsSync(`${abs}.d.ts`)) return `${spec}.js`
  if (existsSync(join(abs, 'index.d.ts'))) return `${spec}/index.js`
  return spec
}
