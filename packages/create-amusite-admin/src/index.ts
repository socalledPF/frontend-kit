import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

export interface CreateAdminOptions {
  directory: string
  name?: string
  force?: boolean
  ruoyi?: boolean
  request?: boolean
  permission?: boolean
  dict?: boolean
  upload?: boolean
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

function mainSource(options: Required<Omit<CreateAdminOptions, 'directory' | 'name' | 'force'>>) {
  const imports = [
    "import { createApp } from 'vue'",
    "import ElementPlus from 'element-plus'",
    "import 'element-plus/dist/index.css'",
    "import AmusiteBusiness from '@amusite/vue3-element-plus-business'",
    "import '@amusite/styles/style.css'",
    "import '@amusite/vue3-element-plus-business/style.css'",
    "import App from './App.vue'"
  ]
  if (options.request || options.permission)
    imports.push("import { businessOptions } from './amusite'")
  return `${imports.join('\n')}\n\ncreateApp(App).use(ElementPlus).use(AmusiteBusiness, ${options.request || options.permission ? 'businessOptions' : '{}'}).mount('#app')\n`
}

function adapterSource(
  options: Required<Omit<CreateAdminOptions, 'directory' | 'name' | 'force'>>
) {
  const lines = ["import type { BusinessHostAdapters } from '@amusite/business-core'"]
  if (options.request) lines.push("import { createRequest } from '@amusite/request'")
  if (options.request && options.ruoyi)
    lines.push(
      "import { createRuoyiDictLoader, createRuoyiRequestAdapter, createRuoyiUploadRequest } from '@amusite/ruoyi-adapter'"
    )
  if (options.request)
    lines.push(
      '',
      "const getToken = () => sessionStorage.getItem('token')",
      options.ruoyi
        ? 'export const request = createRequest({ baseURL: "/api", adapter: createRuoyiRequestAdapter({ getToken }) })'
        : 'export const request = createRequest({ baseURL: "/api", adapter: { getToken } })'
    )
  if (options.upload && options.ruoyi)
    lines.push('export const uploadRequest = createRuoyiUploadRequest(request)')
  if (options.dict && options.ruoyi)
    lines.push('export const loadDict = createRuoyiDictLoader(request)')
  lines.push('', 'export const businessOptions: BusinessHostAdapters = {')
  if (options.permission) lines.push("  permission: { getPermissions: () => ['*:*:*'] },")
  lines.push(
    '  notifyError: (error) => console.error(error),',
    "  locale: { locale: 'zh-CN' }",
    '}'
  )
  return `${lines.join('\n')}\n`
}

function appSource(options: Required<Omit<CreateAdminOptions, 'directory' | 'name' | 'force'>>) {
  return `<script setup lang="ts">\nimport { ref } from 'vue'\n${options.upload ? "import type { UploadItem } from '@amusite/business-core'\nimport { uploadRequest } from './amusite'\nconst files = ref<UploadItem[]>([])" : ''}\nconst query = ref({ keyword: '' })\n</script>\n\n<template>\n  <main class="x-admin-page">\n    <section class="x-admin-section">\n      <XQueryForm v-model:model="query" :fields="[{ prop: 'keyword', label: '关键词' }]" @query="console.log" />\n      ${options.permission ? '<XPermission permission="system:user:list">' : ''}<XProTable :data="[]" :columns="[{ prop: 'name', label: '名称' }]" :total="0" />${options.permission ? '</XPermission>' : ''}\n      ${options.upload ? '<XUpload v-model="files" :request="uploadRequest" />' : ''}\n    </section>\n  </main>\n</template>\n`
}

export async function createAdmin(options: CreateAdminOptions): Promise<string> {
  const directory = resolve(options.directory)
  await mkdir(directory, { recursive: true })
  const entries = await readdir(directory)
  if (entries.length && !options.force)
    throw new Error(`Target directory is not empty: ${directory}`)
  const request = options.request ?? true
  const ruoyi = request && (options.ruoyi ?? true)
  const flags = {
    ruoyi,
    request,
    permission: options.permission ?? true,
    dict: ruoyi && (options.dict ?? true),
    upload: ruoyi && (options.upload ?? true)
  }
  const name = options.name || basename(directory)
  await mkdir(resolve(directory, 'src'), { recursive: true })
  const dependencies: Record<string, string> = {
    '@amusite/business-core': '^0.1.0',
    '@amusite/styles': '^0.2.0',
    '@amusite/vue3-element-plus-business': '^0.1.0',
    'element-plus': '^2.14.0',
    vue: '^3.5.0'
  }
  if (flags.request) dependencies['@amusite/request'] = '^0.2.0'
  if (flags.ruoyi) dependencies['@amusite/ruoyi-adapter'] = '^0.1.0'
  const files: Record<string, string> = {
    'package.json': json({
      name,
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vue-tsc --noEmit && vite build' },
      dependencies,
      devDependencies: {
        '@vitejs/plugin-vue': '^6.0.0',
        typescript: '^5.8.0',
        vite: '~8.1.0',
        'vue-tsc': '^3.3.0'
      }
    }),
    'index.html': '<div id="app"></div><script type="module" src="/src/main.ts"></script>\n',
    'tsconfig.json': json({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        jsx: 'preserve',
        lib: ['ES2022', 'DOM'],
        types: ['vite/client']
      },
      include: ['src/**/*.ts', 'src/**/*.vue']
    }),
    'vite.config.ts':
      "import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\nexport default defineConfig({ plugins: [vue()], server: { proxy: { '/api': 'http://localhost:8080' } } })\n",
    'src/main.ts': mainSource(flags),
    'src/App.vue': appSource(flags),
    'src/env.d.ts': '/// <reference types="vite/client" />\n'
  }
  if (flags.request || flags.permission) files['src/amusite.ts'] = adapterSource(flags)
  await Promise.all(
    Object.entries(files).map(async ([file, content]) => {
      const target = resolve(directory, file)
      await mkdir(resolve(target, '..'), { recursive: true })
      await writeFile(target, content)
    })
  )
  return directory
}

export function parseArgs(args: string[]): CreateAdminOptions {
  const directory = args.find((value) => !value.startsWith('-'))
  if (!directory)
    throw new Error(
      'Usage: create-amusite-admin <directory> [--force] [--no-ruoyi] [--no-request] [--no-permission] [--no-dict] [--no-upload]'
    )
  return {
    directory,
    force: args.includes('--force'),
    ruoyi: !args.includes('--no-ruoyi'),
    request: !args.includes('--no-request'),
    permission: !args.includes('--no-permission'),
    dict: !args.includes('--no-dict'),
    upload: !args.includes('--no-upload')
  }
}

export async function runCli(
  args = process.argv.slice(2),
  logger: Pick<Console, 'log' | 'error'> = console
): Promise<number> {
  try {
    const directory = await createAdmin(parseArgs(args))
    logger.log(`Created ${directory}`)
    return 0
  } catch (error) {
    logger.error(error instanceof Error ? error.message : error)
    return 1
  }
}
