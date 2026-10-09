import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
  type ShallowRef
} from 'vue'

export interface ChartRequestContext {
  requestId: number
  signal?: AbortSignal
}

export interface UseChartRequestOptions<Raw, Data = Raw, Params = void> {
  request: (params: Params, context: ChartRequestContext) => Promise<Raw> | Raw
  params?: MaybeRefOrGetter<Params>
  transform?: (response: Raw) => Data
  initialData?: Data
  immediate?: boolean
  enabled?: MaybeRefOrGetter<boolean>
  watchParams?: boolean
  cancelPrevious?: boolean
  keepDataOnError?: boolean
  pollingInterval?: number
  onSuccess?: (data: Data, response: Raw) => void
  onError?: (error: unknown) => void
}

export interface UseChartRequestReturn<Data> {
  data: ShallowRef<Data | undefined>
  loading: Ref<boolean>
  error: ShallowRef<unknown>
  lastUpdatedAt: Ref<number | undefined>
  polling: ComputedRef<boolean>
  refresh: () => Promise<Data | undefined>
  reload: () => Promise<Data | undefined>
  cancel: () => void
  startPolling: () => void
  stopPolling: () => void
}

export function useChartRequest<Raw, Data = Raw, Params = void>(
  options: UseChartRequestOptions<Raw, Data, Params>
): UseChartRequestReturn<Data> {
  const data = shallowRef<Data | undefined>(options.initialData) as ShallowRef<Data | undefined>
  const loading = ref(false)
  const error = shallowRef<unknown>()
  const lastUpdatedAt = ref<number>()
  const activeRequests = new Map<number, AbortController | undefined>()
  const pollingEnabled = ref(Boolean(options.pollingInterval && options.pollingInterval > 0))
  const polling = computed(() => pollingEnabled.value)
  let sequence = 0
  let latestRequestId = 0
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const isEnabled = () => toValue(options.enabled ?? true)
  const resolveParams = () => toValue(options.params) as Params
  const syncLoading = () => {
    loading.value = activeRequests.size > 0
  }
  const clearPollTimer = () => {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = undefined
  }
  const schedulePolling = () => {
    clearPollTimer()
    const interval = Math.max(0, Number(options.pollingInterval) || 0)
    if (!disposed && pollingEnabled.value && interval && isEnabled()) {
      pollTimer = setTimeout(() => {
        void refresh().catch(() => undefined)
      }, interval)
    }
  }

  const cancel = () => {
    latestRequestId = ++sequence
    activeRequests.forEach((controller) => controller?.abort())
    activeRequests.clear()
    syncLoading()
    clearPollTimer()
  }

  const refresh = async (): Promise<Data | undefined> => {
    if (!isEnabled() || disposed) return data.value
    clearPollTimer()
    if (options.cancelPrevious ?? true) cancel()
    const requestId = ++sequence
    const controller = typeof AbortController === 'undefined' ? undefined : new AbortController()
    latestRequestId = requestId
    activeRequests.set(requestId, controller)
    error.value = undefined
    syncLoading()

    try {
      const response = await options.request(resolveParams(), {
        requestId,
        signal: controller?.signal
      })
      const result = options.transform ? options.transform(response) : (response as unknown as Data)
      if (requestId === latestRequestId && activeRequests.has(requestId)) {
        data.value = result
        lastUpdatedAt.value = Date.now()
        options.onSuccess?.(result, response)
        return result
      }
      return data.value
    } catch (caughtError) {
      if (controller?.signal.aborted || requestId !== latestRequestId) return data.value
      error.value = caughtError
      if (!(options.keepDataOnError ?? true)) data.value = undefined
      options.onError?.(caughtError)
      throw caughtError
    } finally {
      activeRequests.delete(requestId)
      syncLoading()
      if (requestId === latestRequestId) schedulePolling()
    }
  }

  const stopPolling = () => {
    pollingEnabled.value = false
    clearPollTimer()
  }
  const startPolling = () => {
    pollingEnabled.value = true
    schedulePolling()
  }

  if (options.params !== undefined && (options.watchParams ?? true)) {
    watch(
      () => toValue(options.params),
      () => {
        if (isEnabled()) void refresh().catch(() => undefined)
      },
      { deep: true }
    )
  }
  if (options.enabled !== undefined) {
    watch(
      () => toValue(options.enabled),
      (enabled) => {
        if (enabled) void refresh().catch(() => undefined)
        else cancel()
      }
    )
  }
  if (options.immediate ?? true) void refresh().catch(() => undefined)

  onScopeDispose(() => {
    disposed = true
    stopPolling()
    cancel()
  })

  return {
    data,
    loading,
    error,
    lastUpdatedAt,
    polling,
    refresh,
    reload: refresh,
    cancel,
    startPolling,
    stopPolling
  }
}
