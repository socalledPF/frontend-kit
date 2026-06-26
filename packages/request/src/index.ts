import axios, {
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse
} from 'axios'
import type { ApiCode, ApiResponse, RequestAdapter } from '@amusite/shared'
import { getFileNameFromHeader } from '@amusite/utils'

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
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<T>
  download: <T = Blob>(
    url: string,
    config?: Omit<AxiosRequestConfig, 'url' | 'method' | 'responseType'>
  ) => Promise<DownloadResult<T>>
}

export interface RequestErrorOptions {
  code?: ApiCode
  status?: number
  raw?: unknown
  response?: AxiosResponse
  isUnauthorized?: boolean
}

export class RequestError extends Error {
  code?: ApiCode
  status?: number
  raw?: unknown
  response?: AxiosResponse
  isUnauthorized: boolean

  constructor(message: string, options: RequestErrorOptions = {}) {
    super(message)
    this.name = 'RequestError'
    this.code = options.code
    this.status = options.status
    this.raw = options.raw
    this.response = options.response
    this.isUnauthorized = options.isUnauthorized ?? false
  }
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function matchesCode(rule: RequestAdapter['successCode'], code: unknown): boolean {
  if (typeof rule === 'function') {
    return rule(code)
  }

  const successCodes = toArray(rule ?? 200)
  return successCodes.some((item) => String(item) === String(code))
}

function isUnauthorizedCode(adapter: RequestAdapter, code: unknown): boolean {
  const unauthorizedCodes = adapter.unauthorizedCodes ?? [401]
  return unauthorizedCodes.some((item) => String(item) === String(code))
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

  if (typeof headers.get === 'function') {
    return headers.get(name) ?? ''
  }

  return headers[name] ?? headers[name.toLowerCase()] ?? ''
}

function isApiResponse(value: unknown): value is ApiResponse {
  return Boolean(value && typeof value === 'object' && 'code' in value)
}

function getApiMessage(payload: ApiResponse): string {
  return payload.msg ?? payload.message ?? 'Request failed'
}

function getTransportMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Network request failed'
}

function toRequestError(error: unknown, adapter: RequestAdapter): RequestError {
  if (error instanceof RequestError) {
    return error
  }

  const message = adapter.resolveErrorMessage?.(error) ?? getTransportMessage(error)
  return new RequestError(message, { raw: error })
}

function isDownloadResponse(response: AxiosResponse): boolean {
  return response.config.responseType === 'blob' || response.config.responseType === 'arraybuffer'
}

export function createRequest(options: CreateRequestOptions = {}): RequestClient {
  const { adapter = {}, axiosAdapter, ...axiosOptions } = options
  const instance = axios.create({
    ...axiosOptions,
    adapter: axiosAdapter
  })

  instance.interceptors.request.use(async (config) => {
    const token = await adapter.getToken?.()

    if (token) {
      const tokenHeader = adapter.tokenHeader ?? 'Authorization'
      const formatToken = adapter.formatToken ?? defaultFormatToken
      config.headers = setRequestHeader(config.headers, tokenHeader, formatToken(token))
    }

    return config
  })

  instance.interceptors.response.use(
    async (response) => {
      if (isDownloadResponse(response)) {
        return {
          data: response.data,
          fileName: getFileNameFromHeader(getResponseHeader(response, 'content-disposition')),
          response
        }
      }

      const payload = response.data

      if (!isApiResponse(payload)) {
        return payload
      }

      if (matchesCode(adapter.successCode, payload.code)) {
        return payload.data === undefined ? payload : payload.data
      }

      const isUnauthorized = isUnauthorizedCode(adapter, payload.code)

      if (isUnauthorized) {
        await adapter.onUnauthorized?.(payload)
      }

      const message = getApiMessage(payload)
      const error = new RequestError(message, {
        code: payload.code,
        status: response.status,
        raw: payload,
        response,
        isUnauthorized
      })

      adapter.onError?.(message, error)
      throw error
    },
    (error) => {
      const requestError = toRequestError(error, adapter)
      adapter.onError?.(requestError.message, requestError)
      throw requestError
    }
  )

  return {
    instance,
    request: <T = unknown>(config: AxiosRequestConfig) => instance.request<unknown, T>(config),
    get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
      instance.get<unknown, T>(url, config),
    post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      instance.post<unknown, T>(url, data, config),
    put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      instance.put<unknown, T>(url, data, config),
    delete: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
      instance.delete<unknown, T>(url, config),
    download: <T = Blob>(
      url: string,
      config?: Omit<AxiosRequestConfig, 'url' | 'method' | 'responseType'>
    ) =>
      instance.request<unknown, DownloadResult<T>>({
        ...config,
        url,
        method: 'get',
        responseType: 'blob'
      })
  }
}
