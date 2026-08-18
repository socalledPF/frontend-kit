import axios, {
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse
} from 'axios'
import type { ApiCode, ApiResponse, RequestAdapter, RequestLifecycleContext } from '@amusite/shared'
import { getFileNameFromHeader, uuid } from '@amusite/utils'

export interface CreateRequestOptions extends Omit<AxiosRequestConfig, 'adapter'> {
  adapter?: RequestAdapter
  axiosAdapter?: AxiosAdapter
}

export interface DownloadResult<T = Blob> {
  data: T
  fileName: string
  response: AxiosResponse<T>
}

export interface RequestClient {
  instance: AxiosInstance
  request: <T = unknown>(config: AxiosRequestConfig) => Promise<T>
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<T>
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>
  head: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<T>
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<T>
  download: <T = Blob>(url: string, config?: DownloadRequestConfig) => Promise<DownloadResult<T>>
  downloadPost: <T = Blob>(
    url: string,
    data?: unknown,
    config?: DownloadRequestConfig
  ) => Promise<DownloadResult<T>>
}

export type DownloadRequestConfig = Omit<
  AxiosRequestConfig,
  'url' | 'method' | 'responseType' | 'data'
>
export type RequestErrorKind =
  'business' | 'http' | 'network' | 'timeout' | 'cancel' | 'download' | 'unauthorized'

export interface RequestErrorOptions {
  code?: ApiCode
  status?: number
  raw?: unknown
  response?: AxiosResponse
  isUnauthorized?: boolean
  kind?: RequestErrorKind
  requestId?: string
}

export class RequestError extends Error {
  code?: ApiCode
  status?: number
  raw?: unknown
  response?: AxiosResponse
  isUnauthorized: boolean
  kind: RequestErrorKind
  requestId?: string

  constructor(message: string, options: RequestErrorOptions = {}) {
    super(message)
    this.name = 'RequestError'
    this.code = options.code
    this.status = options.status
    this.raw = options.raw
    this.response = options.response
    this.isUnauthorized = options.isUnauthorized ?? false
    this.kind = options.kind ?? 'business'
    this.requestId = options.requestId
  }
}

export function isRequestCanceled(error: unknown): boolean {
  return error instanceof RequestError ? error.kind === 'cancel' : axios.isCancel(error)
}

function toArray<T>(value: T | T[] | undefined): T[] {
  return value == null ? [] : Array.isArray(value) ? value : [value]
}

function matchesCode(rule: RequestAdapter['successCode'], code: unknown): boolean {
  if (typeof rule === 'function') return rule(code)
  return toArray(rule ?? 200).some((item) => String(item) === String(code))
}

function isUnauthorizedCode(adapter: RequestAdapter, code: unknown): boolean {
  return (adapter.unauthorizedCodes ?? [401]).some((item) => String(item) === String(code))
}

function defaultFormatToken(token: string): string {
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`
}

function setRequestHeader(
  headers: AxiosRequestConfig['headers'],
  name: string,
  value: string
): AxiosHeaders {
  const nextHeaders = AxiosHeaders.from(headers as any)
  nextHeaders.set(name, value)
  return nextHeaders
}

function getResponseHeader(response: AxiosResponse, name: string): string {
  const headers = response.headers as Record<string, string> & {
    get?: (key: string) => string | null
  }
  if (typeof headers.get === 'function') return headers.get(name) ?? ''
  return headers[name] ?? headers[name.toLowerCase()] ?? ''
}

function isApiResponse(value: unknown): value is ApiResponse {
  return Boolean(value && typeof value === 'object' && 'code' in value)
}

function getApiMessage(payload: ApiResponse): string {
  return payload.msg ?? payload.message ?? 'Request failed'
}

function getTransportMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Network request failed'
}

function isDownloadResponse(response: AxiosResponse): boolean {
  return response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer'
}

async function parseDownloadPayload(response: AxiosResponse): Promise<unknown | undefined> {
  const contentType =
    getResponseHeader(response, 'content-type') ||
    (typeof Blob !== 'undefined' && response.data instanceof Blob ? response.data.type : '')
  if (!/json|text\//i.test(contentType)) return undefined
  try {
    const text =
      typeof Blob !== 'undefined' && response.data instanceof Blob
        ? await response.data.text()
        : response.data instanceof ArrayBuffer
          ? new TextDecoder().decode(response.data)
          : String(response.data)
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function classifyTransportError(error: unknown): RequestErrorKind {
  if (axios.isCancel(error)) return 'cancel'
  const code = (error as { code?: string } | undefined)?.code
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return 'timeout'
  return axios.isAxiosError(error) && error.response ? 'http' : 'network'
}

export function createRequest(options: CreateRequestOptions = {}): RequestClient {
  const { adapter = {}, axiosAdapter, ...axiosOptions } = options
  const instance = axios.create({ ...axiosOptions, adapter: axiosAdapter })
  const contexts = new WeakMap<object, RequestLifecycleContext>()
  const settled = new WeakSet<object>()
  const retried = new WeakSet<object>()
  let refreshTask: Promise<string | null | undefined> | undefined

  const getContext = (config: AxiosRequestConfig): RequestLifecycleContext => {
    const existing = contexts.get(config as object)
    if (existing) return existing
    const context: RequestLifecycleContext = {
      requestId: adapter.createRequestId?.() ?? uuid(),
      startedAt: Date.now(),
      method: config.method?.toUpperCase(),
      url: config.url
    }
    contexts.set(config as object, context)
    return context
  }

  const settle = async (config: AxiosRequestConfig, error?: unknown) => {
    if (settled.has(config as object)) return
    settled.add(config as object)
    const context = getContext(config)
    context.durationMs = Date.now() - context.startedAt
    await adapter.onSettled?.({ ...context, error })
  }

  const notifyError = (error: RequestError) => {
    if (error.kind !== 'cancel') adapter.onError?.(error.message, error)
  }

  const toRequestError = (error: unknown, config?: AxiosRequestConfig): RequestError => {
    if (error instanceof RequestError) return error
    const kind = classifyTransportError(error)
    const response = axios.isAxiosError(error) ? error.response : undefined
    const message = adapter.resolveErrorMessage?.(error) ?? getTransportMessage(error)
    return new RequestError(message, {
      kind,
      status: response?.status,
      raw: error,
      response,
      isUnauthorized: Boolean(response && isUnauthorizedCode(adapter, response.status)),
      requestId: config ? getContext(config).requestId : undefined
    })
  }

  const refreshAndRetry = async (
    response: AxiosResponse,
    payload: unknown
  ): Promise<{ retried: boolean; value?: unknown }> => {
    const config = response.config
    if (!adapter.refreshToken || retried.has(config as object)) return { retried: false }
    if (adapter.shouldRefreshToken && !adapter.shouldRefreshToken(payload))
      return { retried: false }
    retried.add(config as object)
    try {
      refreshTask ??= Promise.resolve(adapter.refreshToken(payload)).finally(() => {
        refreshTask = undefined
      })
      const refreshed = await refreshTask
      const token = refreshed ?? (await adapter.getToken?.())
      if (!token) return { retried: false }
      const header = adapter.tokenHeader ?? 'Authorization'
      config.headers = setRequestHeader(
        config.headers,
        header,
        (adapter.formatToken ?? defaultFormatToken)(token)
      )
      return { retried: true, value: await instance.request(config) }
    } catch {
      return { retried: false }
    }
  }

  const businessError = async (payload: ApiResponse, response: AxiosResponse) => {
    const isUnauthorized = isUnauthorizedCode(adapter, payload.code)
    if (isUnauthorized) {
      const retry = await refreshAndRetry(response, payload)
      if (retry.retried) return retry.value
      await adapter.onUnauthorized?.(payload)
    }
    throw new RequestError(getApiMessage(payload), {
      code: payload.code,
      status: response.status,
      raw: payload,
      response,
      isUnauthorized,
      kind: isUnauthorized ? 'unauthorized' : 'business',
      requestId: getContext(response.config).requestId
    })
  }

  instance.interceptors.request.use(async (config) => {
    const context = getContext(config)
    const token = await adapter.getToken?.()
    const tokenHeader = adapter.tokenHeader ?? 'Authorization'
    if (token && !AxiosHeaders.from(config.headers).has(tokenHeader)) {
      config.headers = setRequestHeader(
        config.headers,
        tokenHeader,
        (adapter.formatToken ?? defaultFormatToken)(token)
      )
    }
    if (adapter.requestIdHeader !== false) {
      config.headers = setRequestHeader(
        config.headers,
        adapter.requestIdHeader ?? 'X-Request-Id',
        context.requestId
      )
    }
    await adapter.onRequest?.(config, { ...context })
    return config
  })

  instance.interceptors.response.use(
    async (response) => {
      try {
        await adapter.onResponse?.(response, {
          ...getContext(response.config),
          durationMs: Date.now() - getContext(response.config).startedAt
        })
        if (isDownloadResponse(response)) {
          const embedded = await parseDownloadPayload(response)
          if (isApiResponse(embedded)) {
            if (!matchesCode(adapter.successCode, embedded.code))
              return await businessError(embedded, response)
            throw new RequestError(getApiMessage(embedded), {
              kind: 'download',
              raw: embedded,
              response,
              requestId: getContext(response.config).requestId
            })
          }
          await settle(response.config)
          return {
            data: response.data,
            fileName: getFileNameFromHeader(getResponseHeader(response, 'content-disposition')),
            response
          }
        }
        const payload = response.data
        if (!isApiResponse(payload)) {
          await settle(response.config)
          return payload
        }
        if (matchesCode(adapter.successCode, payload.code)) {
          await settle(response.config)
          return payload.data === undefined ? payload : payload.data
        }
        const result = await businessError(payload, response)
        await settle(response.config)
        return result
      } catch (error) {
        const requestError = toRequestError(error, response.config)
        notifyError(requestError)
        await settle(response.config, requestError)
        throw requestError
      }
    },
    async (error) => {
      const response = axios.isAxiosError(error) ? error.response : undefined
      if (response && isUnauthorizedCode(adapter, response.status)) {
        const retry = await refreshAndRetry(response, response.data)
        if (retry.retried) return retry.value
        await adapter.onUnauthorized?.(response.data)
      }
      const requestError = toRequestError(error, response?.config ?? error?.config)
      notifyError(requestError)
      if (response?.config ?? error?.config)
        await settle((response?.config ?? error.config) as AxiosRequestConfig, requestError)
      throw requestError
    }
  )

  return {
    instance,
    request: <T = unknown>(config: AxiosRequestConfig) =>
      instance.request(config) as unknown as Promise<T>,
    get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
      instance.get(url, config) as unknown as Promise<T>,
    post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      instance.post(url, data, config) as unknown as Promise<T>,
    put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      instance.put(url, data, config) as unknown as Promise<T>,
    patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      instance.patch(url, data, config) as unknown as Promise<T>,
    head: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
      instance.head(url, config) as unknown as Promise<T>,
    delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
      instance.delete(url, config) as unknown as Promise<T>,
    download: <T = Blob>(url: string, config?: DownloadRequestConfig) =>
      instance.request({
        ...config,
        url,
        method: 'get',
        responseType: 'blob'
      }) as unknown as Promise<DownloadResult<T>>,
    downloadPost: <T = Blob>(url: string, data?: unknown, config?: DownloadRequestConfig) =>
      instance.request({
        ...config,
        url,
        data,
        method: 'post',
        responseType: 'blob'
      }) as unknown as Promise<DownloadResult<T>>
  }
}
