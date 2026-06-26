import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createRequest, RequestError } from './index'

function readHeader(config: InternalAxiosRequestConfig, name: string): string {
  const headers = config.headers as Record<string, string> & {
    get?: (key: string) => string | null
  }

  if (typeof headers.get === 'function') {
    return headers.get(name) ?? ''
  }

  return headers[name] ?? headers[name.toLowerCase()] ?? ''
}

function mockAdapter(
  data: unknown,
  options: Partial<AxiosResponse> = {}
): AxiosAdapter {
  return async (config) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
    ...options
  })
}

describe('@amusite/request', () => {
  it('unwraps successful RuoYi data responses', async () => {
    const client = createRequest({
      axiosAdapter: mockAdapter({ code: 200, msg: 'ok', data: { name: 'amusite' } })
    })

    await expect(client.get('/user')).resolves.toEqual({ name: 'amusite' })
  })

  it('keeps RuoYi list responses when data is absent', async () => {
    const response = { code: 200, msg: 'ok', rows: [{ id: 1 }], total: 1 }
    const client = createRequest({
      axiosAdapter: mockAdapter(response)
    })

    await expect(client.get('/users')).resolves.toEqual(response)
  })

  it('injects token through the adapter', async () => {
    const transport = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: { code: 200, data: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {}
    }))
    const client = createRequest({
      adapter: {
        getToken: () => 'abc123'
      },
      axiosAdapter: transport as AxiosAdapter
    })

    await client.get('/auth')
    expect(readHeader(transport.mock.calls[0][0], 'Authorization')).toBe('Bearer abc123')
  })

  it('throws RequestError and calls onError for failed business codes', async () => {
    const onError = vi.fn()
    const client = createRequest({
      adapter: {
        onError
      },
      axiosAdapter: mockAdapter({ code: 500, msg: '保存失败' })
    })

    await expect(client.post('/save')).rejects.toMatchObject({
      name: 'RequestError',
      message: '保存失败',
      code: 500
    })
    expect(onError).toHaveBeenCalledWith('保存失败', expect.any(RequestError))
  })

  it('calls onUnauthorized for configured unauthorized codes', async () => {
    const onUnauthorized = vi.fn()
    const client = createRequest({
      adapter: {
        onUnauthorized
      },
      axiosAdapter: mockAdapter({ code: 401, msg: '登录已过期' })
    })

    await expect(client.get('/profile')).rejects.toMatchObject({
      isUnauthorized: true
    })
    expect(onUnauthorized).toHaveBeenCalledWith({ code: 401, msg: '登录已过期' })
  })

  it('parses filenames from download responses', async () => {
    const client = createRequest({
      axiosAdapter: mockAdapter('file-content', {
        headers: {
          'content-disposition': "attachment; filename*=UTF-8''report.xlsx"
        }
      })
    })

    await expect(client.download<string>('/export')).resolves.toMatchObject({
      data: 'file-content',
      fileName: 'report.xlsx'
    })
  })
})
