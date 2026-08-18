import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { getPublishablePackages, rootDir } from './package-utils.mjs'

const requested = new Set(process.argv.slice(2))
const packages = (await getPublishablePackages()).filter(
  ({ manifest }) => requested.size === 0 || requested.has(manifest.name)
)
const bin = (name) =>
  resolve(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)

for (const { directory, manifest } of packages) {
  if (!existsSync(resolve(directory, 'dist'))) {
    throw new Error(`${manifest.name} has not been built`)
  }

  console.log(`\nChecking ${manifest.name}`)
  const destination = mkdtempSync(join(tmpdir(), 'amusite-pack-'))
  try {
    const packed = execFileSync(
      'npm',
      [
        'pack',
        '--json',
        '--ignore-scripts',
        '--cache',
        '/tmp/amusite-npm-cache',
        '--pack-destination',
        destination
      ],
      { cwd: directory, encoding: 'utf8' }
    )
    const [{ filename }] = JSON.parse(packed)
    const tarball = resolve(destination, filename)
    execFileSync(bin('publint'), [tarball, '--strict'], { cwd: rootDir, stdio: 'inherit' })
    const attwArgs = [tarball, '--profile', 'node16']
    if (manifest.exports?.['./style.css']) {
      attwArgs.push('--exclude-entrypoints', './style.css')
    }
    execFileSync(bin('attw'), attwArgs, { cwd: rootDir, stdio: 'inherit' })
  } finally {
    rmSync(destination, { recursive: true, force: true })
  }
}

console.log(`\nValidated ${packages.length} publishable packages.`)
