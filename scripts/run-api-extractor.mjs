import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPublishablePackages, rootDir } from './package-utils.mjs'

const local = process.argv.includes('--local')
const packages = await getPublishablePackages()
const apiExtractor = resolve(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'api-extractor.cmd' : 'api-extractor'
)

for (const { directory, manifest } of packages) {
  const config = resolve(directory, 'api-extractor.json')
  if (!existsSync(config)) continue
  mkdirSync(resolve(directory, 'etc'), { recursive: true })
  console.log(`\nAPI report: ${manifest.name}`)
  execFileSync(apiExtractor, ['run', ...(local ? ['--local'] : []), '--config', config], {
    cwd: rootDir,
    stdio: 'inherit'
  })
}
