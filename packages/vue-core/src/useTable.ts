import { computed, reactive, ref, type ComputedRef, type Ref } from 'vue-demi'
import type { ApiResponse, PageQuery, PageResult, Recordable, TableRequest } from '@amusite/shared'

export interface UseTableFieldMap {
  pageNumKey?: string
  pageSizeKey?: string
  listKey?: string
  totalKey?: string
}

export interface UseTableOptions<T, Q extends object = Recordable> {
  request: (
    query: Q & Partial<PageQuery> & Recordable,
    context: UseTableRequestContext
  ) => ReturnType<TableRequest<T, Q>>
  initialQuery?: Partial<Q>
  immediate?: boolean
  defaultPageNum?: number
  defaultPageSize?: number
  fieldMap?: UseTableFieldMap
  responseAdapter?: (response: unknown) => PageResult<T>
  transformParams?: (params: Q & Recordable) => Q & Partial<PageQuery> & Recordable
  cancelPrevious?: boolean
  keepDataOnError?: boolean
  onError?: (error: unknown) => void
}

export interface UseTableRequestContext {
  requestId: number
  signal?: AbortSignal
}

export interface UseTableReturn<T, Q extends object = Recordable> {
  query: Q
  params: ComputedRef<Q & Recordable>
  pageNum: Ref<number>
  pageSize: Ref<number>
  list: Ref<T[]>
  total: Ref<number>
  loading: Ref<boolean>
  error: Ref<unknown>
  load: () => Promise<PageResult<T>>
  refresh: () => Promise<PageResult<T>>
  cancel: () => void
  search: (patch?: Partial<Q>) => Promise<PageResult<T>>
  reset: (nextQuery?: Partial<Q>) => Promise<PageResult<T>>
  setPage: (value: number) => Promise<PageResult<T>>
  setPageSize: (value: number) => Promise<PageResult<T>>
}

function isRecord(value: unknown): value is Recordable {
  return Boolean(value && typeof value === 'object')
}

function toNumber(value: unknown, fallback = 0): number {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : fallback
}

function hasPageResultShape<T>(value: unknown): value is PageResult<T> {
  return isRecord(value) && Array.isArray(value.list) && typeof value.total === 'number'
}

function resolvePageResult<T>(
  response: unknown,
  options: Pick<UseTableOptions<T>, 'fieldMap' | 'responseAdapter'>
): PageResult<T> {
  if (options.responseAdapter) {
    return options.responseAdapter(response)
  }

  if (Array.isArray(response)) {
    return {
      list: response as T[],
      total: response.length,
      raw: response
    }
  }

  if (hasPageResultShape<T>(response)) {
    return {
      ...response,
      raw: response.raw ?? response
    }
  }

  const fieldMap = options.fieldMap ?? {}
  const listKey = fieldMap.listKey ?? 'rows'
  const totalKey = fieldMap.totalKey ?? 'total'
  const source = isRecord(response) ? response : {}
  const data = isRecord((source as ApiResponse).data)
    ? ((source as ApiResponse).data as Recordable)
    : {}
  const listValue = source[listKey] ?? data[listKey] ?? source.list ?? data.list ?? []
  const totalValue = source[totalKey] ?? data[totalKey]
  const list = Array.isArray(listValue) ? (listValue as T[]) : []

  return {
    list,
    total: toNumber(totalValue, list.length),
    raw: response
  }
}

export function useTable<T, Q extends object = Recordable>(
  options: UseTableOptions<T, Q>
): UseTableReturn<T, Q> {
  const {
    defaultPageNum = 1,
    defaultPageSize = 10,
    immediate = true,
    fieldMap = {},
    cancelPrevious = true,
    keepDataOnError = true
  } = options
  const pageNumKey = fieldMap.pageNumKey ?? 'pageNum'
  const pageSizeKey = fieldMap.pageSizeKey ?? 'pageSize'
  const initialQuery = { ...(options.initialQuery ?? {}) } as Partial<Q>
  const query = reactive({ ...initialQuery }) as Q
  const pageNum = ref(defaultPageNum)
  const pageSize = ref(defaultPageSize)
  const list = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(false)
  const error = ref<unknown>()
  const activeRequests = new Map<number, AbortController | undefined>()
  let requestSequence = 0
  let latestRequestId = 0
  const params = computed(() => {
    return {
      ...(query as Recordable),
      [pageNumKey]: pageNum.value,
      [pageSizeKey]: pageSize.value
    } as Q & Recordable
  })

  const syncLoading = () => {
    loading.value = activeRequests.size > 0
  }

  const cancel = () => {
    latestRequestId = ++requestSequence
    activeRequests.forEach((controller) => controller?.abort())
    activeRequests.clear()
    syncLoading()
  }

  const load = async () => {
    if (cancelPrevious) {
      cancel()
    }

    const requestId = ++requestSequence
    const controller = typeof AbortController === 'undefined' ? undefined : new AbortController()
    const context: UseTableRequestContext = {
      requestId,
      signal: controller?.signal
    }

    latestRequestId = requestId
    activeRequests.set(requestId, controller)
    syncLoading()
    error.value = undefined

    try {
      const rawParams = { ...params.value } as Q & Recordable
      const requestParams = options.transformParams
        ? options.transformParams(rawParams)
        : (rawParams as Q & Partial<PageQuery> & Recordable)
      const response = await options.request(requestParams, context)
      const result = resolvePageResult<T>(response, options)

      if (requestId === latestRequestId && activeRequests.has(requestId)) {
        list.value = result.list
        total.value = result.total
      }

      return result
    } catch (caughtError) {
      if (controller?.signal.aborted) {
        return {
          list: [...list.value],
          total: total.value,
          raw: caughtError
        }
      }

      if (requestId === latestRequestId && activeRequests.has(requestId)) {
        error.value = caughtError

        if (!keepDataOnError) {
          list.value = []
          total.value = 0
        }

        options.onError?.(caughtError)
      }

      throw caughtError
    } finally {
      activeRequests.delete(requestId)
      syncLoading()
    }
  }

  const search = (patch?: Partial<Q>) => {
    if (patch) {
      Object.assign(query as Recordable, patch)
    }

    pageNum.value = defaultPageNum
    return load()
  }

  const reset = (nextQuery?: Partial<Q>) => {
    Object.keys(query as Recordable).forEach((key) => {
      delete (query as Recordable)[key]
    })
    Object.assign(query as Recordable, initialQuery, nextQuery)
    pageNum.value = defaultPageNum
    return load()
  }

  const setPage = (value: number) => {
    pageNum.value = value
    return load()
  }

  const setPageSize = (value: number) => {
    pageSize.value = value
    pageNum.value = defaultPageNum
    return load()
  }

  if (immediate) {
    void load().catch(() => undefined)
  }

  return {
    query,
    params,
    pageNum,
    pageSize,
    list,
    total,
    loading,
    error,
    load,
    refresh: load,
    cancel,
    search,
    reset,
    setPage,
    setPageSize
  }
}
