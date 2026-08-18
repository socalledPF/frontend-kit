export type MaybePromise<T> = T | Promise<T>

export type ApiCode = string | number

export type Recordable<T = unknown> = Record<string, T>

export interface ApiResponse<T = unknown> extends Recordable {
  code: ApiCode
  msg?: string
  message?: string
  data?: T
  rows?: unknown[]
  total?: number
}

export interface PageQuery extends Recordable {
  pageNum: number
  pageSize: number
}

export interface PageResult<T> {
  list: T[]
  total: number
  raw?: unknown
}

export interface DictOption<Value extends string | number = string | number> extends Recordable {
  label: string
  value: Value
  disabled?: boolean
  raw?: unknown
}

export interface RequestAdapter {
  getToken?: () => MaybePromise<string | null | undefined>
  tokenHeader?: string
  formatToken?: (token: string) => string
  successCode?: ApiCode | ApiCode[] | ((code: unknown) => boolean)
  unauthorizedCodes?: ApiCode[]
  resolveErrorMessage?: (error: unknown) => string
  onError?: (message: string, error: unknown) => void
  onUnauthorized?: (payload: unknown) => MaybePromise<void>
  refreshToken?: (payload: unknown) => MaybePromise<string | null | undefined>
  shouldRefreshToken?: (payload: unknown) => boolean
  requestIdHeader?: string | false
  createRequestId?: () => string
  onRequest?: (config: unknown, context: RequestLifecycleContext) => MaybePromise<void>
  onResponse?: (response: unknown, context: RequestLifecycleContext) => MaybePromise<void>
  onSettled?: (context: RequestLifecycleContext & { error?: unknown }) => MaybePromise<void>
}

export interface RequestLifecycleContext {
  requestId: string
  startedAt: number
  durationMs?: number
  method?: string
  url?: string
}

export type TableRequest<T, Q extends object = Recordable> = (
  query: Q & Partial<PageQuery>
) => MaybePromise<PageResult<T> | ApiResponse | Recordable>
