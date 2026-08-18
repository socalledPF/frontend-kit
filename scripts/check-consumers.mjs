import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { getPublishablePackages, rootDir } from './package-utils.mjs'

const packages = await getPublishablePackages()
const workspace = mkdtempSync(join(tmpdir(), 'amusite-consumers-'))
const tarballs = new Map()
const selectedConsumer = process.env.AMUSITE_CONSUMER

function ensure(directory) {
  mkdirSync(directory, { recursive: true })
}

function link(target, destination) {
  ensure(dirname(destination))
  symlinkSync(target, destination, 'junction')
}

function installPackedPackages(fixture) {
  for (const { manifest } of packages) {
    const target = manifest.name.startsWith('@amusite/')
      ? join(fixture, 'node_modules', '@amusite', manifest.name.slice('@amusite/'.length))
      : join(fixture, 'node_modules', manifest.name)
    ensure(target)
    execFileSync(
      'tar',
      ['-xzf', tarballs.get(manifest.name), '-C', target, '--strip-components=1'],
      {
        env: { ...process.env, LANG: 'C', LC_ALL: 'C' }
      }
    )
  }
}

function externalPath(candidates) {
  const path = candidates.map((candidate) => resolve(rootDir, candidate)).find(existsSync)
  if (!path) throw new Error(`Missing fixture peer: ${candidates.join(', ')}`)
  return path
}

function provisionPeerFixture(name, dependencies) {
  const directory = join(workspace, `${name}-peers`)
  ensure(directory)
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, dependencies }))
  execFileSync(
    'npm',
    ['install', '--no-package-lock', '--legacy-peer-deps', '--cache', '/tmp/amusite-npm-cache'],
    { cwd: directory, stdio: 'inherit' }
  )
  return join(directory, 'node_modules')
}

function verifyFixture(name, peers, businessPackage) {
  const fixture = join(workspace, name)
  ensure(join(fixture, 'node_modules'))
  installPackedPackages(fixture)
  for (const [dependency, candidates] of Object.entries(peers)) {
    link(externalPath(candidates), join(fixture, 'node_modules', ...dependency.split('/')))
  }

  const source = `
import plugin, { Upload } from '${businessPackage}'
import UploadEntry from '${businessPackage}/upload'
import { createRequest } from '@amusite/request'
import { createRuoyiRequestAdapter } from '@amusite/ruoyi-adapter'
if (!plugin || !Upload || !UploadEntry || typeof createRequest !== 'function' || typeof createRuoyiRequestAdapter !== 'function') throw new Error('ESM consumer failed')
`
  execFileSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: fixture,
    stdio: 'inherit'
  })
  execFileSync(
    process.execPath,
    [
      '--input-type=commonjs',
      '--eval',
      `
const plugin = require('${businessPackage}')
const upload = require('${businessPackage}/upload')
const request = require('@amusite/request')
if (!plugin.default || !plugin.Upload || !upload.default || typeof request.createRequest !== 'function') throw new Error('CJS consumer failed')
`
    ],
    { cwd: fixture, stdio: 'inherit' }
  )

  writeFileSync(
    join(fixture, 'consumer.ts'),
    `
import plugin, { type UploadItem } from '${businessPackage}'
import Upload from '${businessPackage}/upload'
import { createRequest } from '@amusite/request'
const files: UploadItem[] = []
void [plugin, Upload, files, createRequest]
`
  )
  writeFileSync(
    join(fixture, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        lib: ['ES2022', 'DOM']
      },
      include: ['consumer.ts']
    })
  )
  execFileSync(resolve(rootDir, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], {
    cwd: fixture,
    stdio: 'inherit'
  })
  console.log(`Validated isolated ${name} consumer.`)
}

try {
  const destination = join(workspace, 'tarballs')
  ensure(destination)
  for (const { directory, manifest } of packages) {
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
    tarballs.set(manifest.name, join(destination, filename))
  }

  if (!selectedConsumer || selectedConsumer === 'vue2') {
    const custom = process.env.AMUSITE_TEST_VUE_VERSION
      ? provisionPeerFixture('vue2', {
          vue: process.env.AMUSITE_TEST_VUE_VERSION,
          'element-ui': process.env.AMUSITE_TEST_UI_VERSION || '2.15.14',
          axios: '^1.7.0'
        })
      : undefined
    verifyFixture(
      'vue2',
      {
        vue: [custom ? `${custom}/vue` : 'apps/playground-vue2/node_modules/vue'],
        'element-ui': [
          custom ? `${custom}/element-ui` : 'apps/playground-vue2/node_modules/element-ui'
        ],
        axios: [custom ? `${custom}/axios` : 'packages/request/node_modules/axios']
      },
      '@amusite/vue2-element-business'
    )
  }

  if (!selectedConsumer || selectedConsumer === 'vue3') {
    const custom = process.env.AMUSITE_TEST_VUE_VERSION
      ? provisionPeerFixture('vue3', {
          vue: process.env.AMUSITE_TEST_VUE_VERSION,
          'element-plus': process.env.AMUSITE_TEST_UI_VERSION || 'latest',
          '@element-plus/icons-vue': '^2.3.1',
          axios: '^1.7.0'
        })
      : undefined
    verifyFixture(
      'vue3',
      {
        vue: [custom ? `${custom}/vue` : 'apps/playground-vue3/node_modules/vue'],
        'element-plus': [
          custom ? `${custom}/element-plus` : 'apps/playground-vue3/node_modules/element-plus'
        ],
        '@element-plus/icons-vue': [
          custom
            ? `${custom}/@element-plus/icons-vue`
            : 'packages/vue3-element-plus-business/node_modules/@element-plus/icons-vue'
        ],
        axios: [custom ? `${custom}/axios` : 'packages/request/node_modules/axios']
      },
      '@amusite/vue3-element-plus-business'
    )
  }
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
