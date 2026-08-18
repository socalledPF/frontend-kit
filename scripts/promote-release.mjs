import { execFileSync } from 'node:child_process'
import { getPublishablePackages } from './package-utils.mjs'

const tag = process.argv[2] || 'latest'
const registry = process.env.NPM_REGISTRY_URL
if (!registry) throw new Error('NPM_REGISTRY_URL is required')

for (const { manifest } of await getPublishablePackages()) {
  const target = `${manifest.name}@${manifest.version}`
  execFileSync('npm', ['view', target, 'version', '--registry', registry], { stdio: 'inherit' })
  execFileSync('npm', ['dist-tag', 'add', target, tag, '--registry', registry], {
    stdio: 'inherit'
  })
}
