import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const rootDir = resolve(import.meta.dirname, '..')

export async function getPublishablePackages() {
  const packagesDir = resolve(rootDir, 'packages')
  const entries = await readdir(packagesDir, { withFileTypes: true })
  const packages = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const directory = resolve(packagesDir, entry.name)
    const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'))
    if (!manifest.private) packages.push({ directory, manifest })
  }

  return packages.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name))
}
