import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useChartRequest } from '../composables/useChartRequest'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useChartRequest', () => {
  it('loads, transforms, watches params, and ignores stale results', async () => {
    let resolveFirst!: (value: number) => void
    let resolveSecond!: (value: number) => void
    const params = ref({ range: 'week' })
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            resolveSecond = resolve
          })
      )
    const scope = effectScope()
    const state = scope.run(() =>
      useChartRequest({ request, params, transform: (value) => value * 2, immediate: false })
    )!

    const first = state.refresh()
    params.value = { range: 'month' }
    await nextTick()
    resolveFirst(1)
    resolveSecond(3)
    await Promise.all([first, vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))])
    await vi.waitFor(() => expect(state.data.value).toBe(6))
    expect(state.lastUpdatedAt.value).toEqual(expect.any(Number))
    scope.stop()
  })

  it('aborts prior requests and restores loading after cancellation', async () => {
    const signals: AbortSignal[] = []
    const request = vi.fn(
      (_params: void, context: { signal?: AbortSignal }) =>
        new Promise<number>((resolve) => {
          if (context.signal) signals.push(context.signal)
          setTimeout(() => resolve(signals.length), 10)
        })
    )
    const scope = effectScope()
    const state = scope.run(() => useChartRequest({ request, immediate: false }))!
    const first = state.refresh()
    const second = state.refresh()
    expect(signals[0].aborted).toBe(true)
    await expect(first).resolves.toBeUndefined()
    await expect(second).resolves.toBe(2)
    expect(state.loading.value).toBe(false)
    state.cancel()
    scope.stop()
  })

  it('reports failures, optionally clears data, and supports polling controls', async () => {
    vi.useFakeTimers()
    const onError = vi.fn()
    const request = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(2)
    const scope = effectScope()
    const state = scope.run(() =>
      useChartRequest({
        request,
        initialData: 0,
        immediate: false,
        keepDataOnError: false,
        pollingInterval: 100,
        onError
      })
    )!

    await state.refresh()
    expect(state.data.value).toBe(1)
    await vi.advanceTimersByTimeAsync(100)
    await vi.waitFor(() => expect(onError).toHaveBeenCalled())
    expect(state.data.value).toBeUndefined()
    state.stopPolling()
    expect(state.polling.value).toBe(false)
    state.startPolling()
    await vi.advanceTimersByTimeAsync(100)
    await vi.waitFor(() => expect(state.data.value).toBe(2))
    scope.stop()
  })

  it('does not request while disabled and clears errors after a successful retry', async () => {
    const enabled = ref(false)
    const request = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce(4)
    const scope = effectScope()
    const state = scope.run(() => useChartRequest({ request, enabled, immediate: false }))!
    await expect(state.refresh()).resolves.toBeUndefined()
    enabled.value = true
    await nextTick()
    await vi.waitFor(() => expect(state.error.value).toEqual(new Error('failed')))
    await expect(state.refresh()).resolves.toBe(4)
    expect(state.error.value).toBeUndefined()
    scope.stop()
  })
})
