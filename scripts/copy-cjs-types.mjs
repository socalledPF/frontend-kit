import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

function normalizeSpecifier(specifier) {
  if (!specifier.startsWith('.') || /\.(?:[cm]?js|json|css)$/.test(specifier)) return specifier
  return `${specifier}.js`
}

async function copyDeclarations(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return copyDeclarations(path)
      if (!entry.name.endsWith('.d.ts')) return
      const source = await readFile(path, 'utf8')
      const normalized = source.replace(
        /(from\s+|import\s*\()(['"])(\.[^'"]+)\2/g,
        (_match, prefix, quote, specifier) =>
          `${prefix}${quote}${normalizeSpecifier(specifier)}${quote}`
      )
      if (normalized !== source) await writeFile(path, normalized)
      const target = path.slice(0, -extname(path).length) + '.cts'
      await copyFile(path, target)
    })
  )
}

const directory = resolve(process.argv[2] || 'dist')
await copyDeclarations(directory)
