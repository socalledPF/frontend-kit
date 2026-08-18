import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createAdmin, parseArgs, runCli } from './index'

async function temporaryDirectory(name: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `amusite-${name}-`))
}

describe('create-amusite-admin', () => {
  it('creates the default Vue 3 and RuoYi preset', async () => {
    const directory = await temporaryDirectory('default')
    await createAdmin({ directory, name: 'company-admin' })

    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    const main = await readFile(join(directory, 'src/main.ts'), 'utf8')
    const app = await readFile(join(directory, 'src/App.vue'), 'utf8')
    const adapters = await readFile(join(directory, 'src/amusite.ts'), 'utf8')

    expect(manifest.name).toBe('company-admin')
    expect(manifest.dependencies).toMatchObject({
      '@amusite/request': '^0.2.0',
      '@amusite/ruoyi-adapter': '^0.1.0',
      '@amusite/vue3-element-plus-business': '^0.1.0'
    })
    expect(main).toContain('.use(AmusiteBusiness, businessOptions)')
    expect(app).toContain('<XQueryForm')
    expect(app).toContain('<XProTable')
    expect(app).toContain('<XUpload')
    expect(adapters).toContain('createRuoyiRequestAdapter')
    expect(adapters).toContain('createRuoyiDictLoader')
  })

  it('creates a minimal preset without request-dependent features', async () => {
    const directory = await temporaryDirectory('minimal')
    await createAdmin({ directory, request: false, permission: false })

    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    const main = await readFile(join(directory, 'src/main.ts'), 'utf8')
    const app = await readFile(join(directory, 'src/App.vue'), 'utf8')

    expect(manifest.dependencies['@amusite/request']).toBeUndefined()
    expect(manifest.dependencies['@amusite/ruoyi-adapter']).toBeUndefined()
    expect(main).not.toContain("from './amusite'")
    expect(app).not.toContain('XUpload')
  })

  it('protects non-empty directories unless force is enabled', async () => {
    const directory = await temporaryDirectory('existing')
    await writeFile(join(directory, 'existing.txt'), 'keep')

    await expect(createAdmin({ directory })).rejects.toThrow('Target directory is not empty')
    await expect(
      createAdmin({ directory, force: true, permission: false, upload: false })
    ).resolves.toBe(directory)
  })

  it('parses CLI presets and reports command outcomes', async () => {
    expect(parseArgs(['admin', '--force', '--no-ruoyi', '--no-permission'])).toMatchObject({
      directory: 'admin',
      force: true,
      ruoyi: false,
      permission: false
    })
    expect(() => parseArgs(['--force'])).toThrow('Usage: create-amusite-admin')

    const directory = await temporaryDirectory('cli')
    const logger = { log: vi.fn(), error: vi.fn() }
    await expect(runCli([directory, '--no-request', '--no-permission'], logger)).resolves.toBe(0)
    expect(logger.log).toHaveBeenCalledWith(`Created ${directory}`)
    await expect(runCli([], logger)).resolves.toBe(1)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Usage:'))
  })
})
