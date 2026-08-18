import {
  AxiosError,
  CanceledError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig
} from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createRequest, isRequestCanceled, RequestError } from './index'

function readHeader(config: InternalAxiosRequestConfig, name: string): string {
  const headers = config.headers as Record<string, string> & {
    get?: (key: string) => string | null
  }

  if (typeof headers.get === 'function') {
    return headers.get(name) ?? ''
  }

  return headers[name] ?? headers[name.toLowerCase()] ?? ''
}

function mockAdapter(data: unknown, options: Partial<AxiosResponse> = {}): AxiosAdapter {
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

  it('supports patch, head and POST downloads', async () => {
    const transport = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: config.responseType === 'blob' ? 'download' : { code: 200, data: config.method },
      status: 200,
      statusText: 'OK',
      headers: { 'content-disposition': 'attachment; filename=result.csv' },
      config,
      request: {}
    }))
    const client = createRequest({ axiosAdapter: transport as AxiosAdapter })

    await expect(client.patch('/record', {})).resolves.toBe('patch')
    await expect(client.head('/record')).resolves.toBe('head')
    await expect(client.downloadPost<string>('/export', { ids: [1] })).resolves.toMatchObject({
      data: 'download',
      fileName: 'result.csv'
    })
    expect(transport.mock.calls.at(-1)?.[0].method).toBe('post')
  })

  it('adds request IDs and reports request lifecycle timing', async () => {
    const onRequest = vi.fn()
    const onResponse = vi.fn()
    const onSettled = vi.fn()
    const transport = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: { code: 200, data: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {}
    }))
    const client = createRequest({
      adapter: { createRequestId: () => 'request-1', onRequest, onResponse, onSettled },
      axiosAdapter: transport as AxiosAdapter
    })

    await client.get('/lifecycle')

    expect(readHeader(transport.mock.calls[0][0], 'X-Request-Id')).toBe('request-1')
    expect(onRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requestId: 'request-1' })
    )
    expect(onResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ durationMs: expect.any(Number) })
    )
    expect(onSettled).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'request-1', durationMs: expect.any(Number) })
    )
  })

  it('refreshes a token once for concurrent unauthorized responses', async () => {
    let releaseRefresh!: (value: string) => void
    const refreshToken = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          releaseRefresh = resolve
        })
    )
    const transport = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data:
        readHeader(config, 'Authorization') === 'Bearer fresh'
          ? { code: 200, data: config.url }
          : { code: 401, msg: 'expired' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {}
    }))
    const client = createRequest({
      adapter: { getToken: () => 'old', refreshToken },
      axiosAdapter: transport as AxiosAdapter
    })

    const first = client.get('/first')
    const second = client.get('/second')
    await vi.waitFor(() => expect(refreshToken).toHaveBeenCalledTimes(1))
    releaseRefresh('fresh')

    await expect(Promise.all([first, second])).resolves.toEqual(['/first', '/second'])
    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(transport).toHaveBeenCalledTimes(4)
  })

  it('parses business errors embedded in Blob downloads', async () => {
    const payload = new Blob([JSON.stringify({ code: 500, msg: '导出失败' })], {
      type: 'application/json'
    })
    const client = createRequest({
      axiosAdapter: mockAdapter(payload, { headers: { 'content-type': 'application/json' } })
    })

    await expect(client.download('/export')).rejects.toMatchObject({
      kind: 'business',
      message: '导出失败'
    })
  })

  it('classifies cancellation without notifying the UI adapter', async () => {
    const onError = vi.fn()
    const client = createRequest({
      adapter: { onError },
      axiosAdapter: (async () => {
        throw new CanceledError('cancelled')
      }) as AxiosAdapter
    })

    const result = client.get('/cancel')
    await expect(result).rejects.toMatchObject({ kind: 'cancel' })
    await result.catch((error) => expect(isRequestCanceled(error)).toBe(true))
    expect(onError).not.toHaveBeenCalled()
  })

  it('classifies HTTP and timeout errors', async () => {
    const config = { headers: {} } as InternalAxiosRequestConfig
    const response = {
      status: 503,
      statusText: 'Unavailable',
      data: {},
      headers: {},
      config
    } as AxiosResponse
    const http = createRequest({
      axiosAdapter: (async () => {
        throw new AxiosError('unavailable', 'ERR_BAD_RESPONSE', config, {}, response)
      }) as AxiosAdapter
    })
    const timeout = createRequest({
      axiosAdapter: (async () => {
        throw new AxiosError('timeout', 'ECONNABORTED', config)
      }) as AxiosAdapter
    })

    await expect(http.get('/http')).rejects.toMatchObject({ kind: 'http', status: 503 })
    await expect(timeout.get('/timeout')).rejects.toMatchObject({ kind: 'timeout' })
    expect(isRequestCanceled(new Error('other'))).toBe(false)
  })
})
