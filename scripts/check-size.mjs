import { gzipSync } from 'node:zlib'
import { readFile, readdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { rootDir } from './package-utils.mjs'

const budgets = [
  ['packages/vue2-element-business/dist/index.mjs', 28 * 1024],
  ['packages/vue2-element-business/dist/style.css', 4 * 1024],
  ['packages/vue3-element-plus-business/dist/index.mjs', 30 * 1024],
  ['packages/vue3-element-plus-business/dist/style.css', 5 * 1024],
  ['packages/vue3-echarts-business/dist/index.mjs', 8 * 1024],
  ['packages/vue3-echarts-business/dist/style.css', 6 * 1024]
]

let failed = false
for (const [file, limit] of budgets) {
  const content = await readFile(resolve(rootDir, file))
  const size = gzipSync(content).byteLength
  const result = size <= limit ? 'PASS' : 'FAIL'
  console.log(
    `${result} ${file}: ${(size / 1024).toFixed(1)} KiB / ${(limit / 1024).toFixed(1)} KiB gzip`
  )
  failed ||= size > limit
}

if (failed) process.exitCode = 1

const vue2Entries = await readdir(resolve(rootDir, 'packages/vue2-element-business/dist/entries'))
for (const entry of vue2Entries.filter((file) => file.endsWith('.mjs'))) {
  const file = resolve(rootDir, 'packages/vue2-element-business/dist/entries', entry)
  const size = gzipSync(await readFile(file)).byteLength
  const limit = 18 * 1024
  console.log(
    `${size <= limit ? 'PASS' : 'FAIL'} Vue2/${basename(entry, '.mjs')}: ${(size / 1024).toFixed(1)} KiB / 18.0 KiB gzip`
  )
  failed ||= size > limit
}

const vue3Dist = resolve(rootDir, 'packages/vue3-element-plus-business/dist')
const vue3Entries = (await readdir(vue3Dist)).filter(
  (file) => file.endsWith('.mjs') && file !== 'index.mjs'
)
for (const entry of vue3Entries) {
  const source = await readFile(resolve(vue3Dist, entry), 'utf8')
  const chunk = source.match(/from\s+["']\.\/(.+?)["']/)?.[1]
  const contents = [source]
  if (chunk) contents.push(await readFile(resolve(vue3Dist, chunk), 'utf8'))
  const size = gzipSync(contents.join('\n')).byteLength
  const limit = 14 * 1024
  console.log(
    `${size <= limit ? 'PASS' : 'FAIL'} Vue3/${basename(entry, '.mjs')}: ${(size / 1024).toFixed(1)} KiB / 14.0 KiB gzip`
  )
  failed ||= size > limit
}

const chartDist = resolve(rootDir, 'packages/vue3-echarts-business/dist')
const chartEntries = (await readdir(chartDist)).filter(
  (file) => file.endsWith('.mjs') && file !== 'index.mjs'
)
for (const entry of chartEntries) {
  const source = await readFile(resolve(chartDist, entry), 'utf8')
  const chunks = [...source.matchAll(/from\s+["']\.\/(.+?)["']/g)].map((match) => match[1])
  const contents = [source]
  for (const chunk of chunks) contents.push(await readFile(resolve(chartDist, chunk), 'utf8'))
  const size = gzipSync(contents.join('\n')).byteLength
  const limit = 12 * 1024
  console.log(
    `${size <= limit ? 'PASS' : 'FAIL'} Charts/${basename(entry, '.mjs')}: ${(size / 1024).toFixed(1)} KiB / 12.0 KiB gzip`
  )
  failed ||= size > limit
}

if (failed) process.exitCode = 1
