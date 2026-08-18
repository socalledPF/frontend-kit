import type { RequestClient } from '@amusite/request'
import { describe, expect, it, vi } from 'vitest'
import {
  adaptRuoyiPage,
  createRuoyiDictLoader,
  createRuoyiExportRequest,
  createRuoyiImportRequest,
  createRuoyiPermissionProvider,
  createRuoyiRequestAdapter,
  createRuoyiUploadRequest
} from './index'

function mockClient(methods: Partial<RequestClient>): RequestClient {
  return methods as RequestClient
}

describe('@amusite/ruoyi-adapter', () => {
  it('creates overridable RuoYi response defaults', () => {
    expect(createRuoyiRequestAdapter()).toMatchObject({
      successCode: 200,
      unauthorizedCodes: [401]
    })
    expect(createRuoyiRequestAdapter({ successCode: 0, unauthorizedCodes: [403] })).toMatchObject({
      successCode: 0,
      unauthorizedCodes: [403]
    })
  })

  it('adapts top-level, nested and invalid page responses', () => {
    expect(adaptRuoyiPage<{ id: number }>({ rows: [{ id: 1 }], total: '2' })).toMatchObject({
      list: [{ id: 1 }],
      total: 2
    })
    expect(adaptRuoyiPage({ data: { list: ['a'] } })).toMatchObject({ list: ['a'], total: 1 })
    expect(adaptRuoyiPage(null)).toMatchObject({ list: [], total: 0 })
  })

  it('builds upload form data and forwards progress', async () => {
    const post = vi.fn(async (_url, body: FormData, config) => {
      config?.onUploadProgress?.({ loaded: 5, total: 10 } as never)
      expect(body.get('file')).toBeInstanceOf(File)
      expect(body.getAll('tags')).toEqual(['one', 'two'])
      expect(body.get('filters')).toBe('{"active":true}')
      return { data: { id: 7, url: '/files/a.txt' } }
    })
    const upload = createRuoyiUploadRequest(mockClient({ post } as Partial<RequestClient>))
    const onProgress = vi.fn()
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' })

    await expect(
      upload({
        file,
        fieldName: 'file',
        data: { tags: ['one', 'two'], filters: { active: true }, skipped: undefined },
        onProgress
      })
    ).resolves.toMatchObject({ id: 7, name: 'a.txt', url: '/files/a.txt', size: 5 })
    expect(post).toHaveBeenCalledWith('/common/upload', expect.any(FormData), expect.any(Object))
    expect(onProgress).toHaveBeenCalledWith(50)
  })

  it('supports custom upload mapping and indeterminate progress', async () => {
    const post = vi.fn(async (_url, _body, config) => {
      config?.onUploadProgress?.({ loaded: 1 } as never)
      return { path: '/custom' }
    })
    const mapResponse = vi.fn((_response, file: File) => ({ name: file.name, url: '/custom' }))
    const upload = createRuoyiUploadRequest(mockClient({ post } as Partial<RequestClient>), {
      url: '/upload',
      mapResponse
    })
    const onProgress = vi.fn()

    await expect(
      upload({ file: new File(['x'], 'x.bin'), fieldName: 'data', data: {}, onProgress })
    ).resolves.toMatchObject({ url: '/custom' })
    expect(onProgress).toHaveBeenCalledWith(0)
  })

  it('maps import forms and optional responses', async () => {
    const post = vi.fn(async (_url, body: FormData, config) => {
      config?.onUploadProgress?.({ loaded: 2, total: 4 } as never)
      expect(body.get('overwrite')).toBe('true')
      return { imported: 3 }
    })
    const importer = createRuoyiImportRequest(mockClient({ post } as Partial<RequestClient>), {
      url: '/import',
      updateExistingField: 'overwrite',
      mapResponse: (response) => ({ successCount: (response as { imported: number }).imported })
    })
    const onProgress = vi.fn()

    await expect(
      importer({
        file: new File(['x'], 'data.xlsx'),
        fieldName: 'file',
        data: {},
        updateExisting: true,
        onProgress
      })
    ).resolves.toEqual({ successCount: 3 })
    expect(onProgress).toHaveBeenCalledWith(50)
  })

  it('uses GET or POST download methods and fallback names', async () => {
    const download = vi.fn().mockResolvedValue({ data: new Blob(['a']), fileName: '' })
    const downloadPost = vi
      .fn()
      .mockResolvedValue({ data: new Blob(['b']), fileName: 'server.xlsx' })
    const client = mockClient({ download, downloadPost } as Partial<RequestClient>)

    await expect(
      createRuoyiExportRequest(client, '/export', { method: 'get', fileName: 'fallback.xlsx' })({
        q: 1
      })
    ).resolves.toMatchObject({ fileName: 'fallback.xlsx' })
    await expect(createRuoyiExportRequest(client, '/export')({ ids: [1] })).resolves.toMatchObject({
      fileName: 'server.xlsx'
    })
    expect(download).toHaveBeenCalledWith('/export', { params: { q: 1 } })
    expect(downloadPost).toHaveBeenCalledWith('/export', { ids: [1] })
  })

  it('loads RuoYi dictionaries and permission identities', async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        { dictLabel: '正常', dictValue: '0', listClass: 'success', cssClass: 'ok', status: '1' }
      ]
    })
    const loader = createRuoyiDictLoader(mockClient({ get } as Partial<RequestClient>))
    await expect(loader('sys status')).resolves.toEqual([
      expect.objectContaining({
        label: '正常',
        value: '0',
        type: 'success',
        className: 'ok',
        disabled: true
      })
    ])
    expect(get).toHaveBeenCalledWith('/system/dict/data/type/sys%20status')

    const provider = createRuoyiPermissionProvider({
      getPermissions: () => ['system:user:list'],
      getRoles: () => ['operator'],
      superPermission: '*',
      superRole: 'root'
    })
    expect(provider.getPermissions?.()).toEqual(['system:user:list'])
    expect(provider.superPermissions).toEqual(['*'])
    expect(provider.superRoles).toEqual(['root'])
  })
})
