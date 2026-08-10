import { describe, expect, it, vi } from 'vitest'
import { useAsyncAction, useDict, useModal, useSelection, useTable } from './index'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('@amusite/vue-core', () => {
  it('loads RuoYi table data and handles pagination', async () => {
    const request = vi.fn(
      async (params: { name?: string; pageNum?: number; pageSize?: number }) => ({
        code: 200,
        rows: [{ id: params.pageNum ?? 1, name: params.name ?? '' }],
        total: 2
      })
    )
    const table = useTable<{ id: number; name: string }, { name?: string }>({
      request,
      initialQuery: { name: 'admin' },
      immediate: false
    })

    expect(table.params.value).toMatchObject({ name: 'admin', pageNum: 1, pageSize: 10 })

    await table.load()
    expect(table.list.value).toEqual([{ id: 1, name: 'admin' }])
    expect(table.total.value).toBe(2)

    await table.setPage(2)
    expect(request).toHaveBeenLastCalledWith(
      { name: 'admin', pageNum: 2, pageSize: 10 },
      expect.objectContaining({ requestId: expect.any(Number) })
    )
  })

  it('resets table state and recovers loading on failure', async () => {
    const error = new Error('failed')
    const request = vi.fn().mockRejectedValue(error)
    const onError = vi.fn()
    const table = useTable<{ id: number }, { keyword?: string }>({
      request,
      initialQuery: { keyword: 'old' },
      immediate: false,
      onError
    })

    await expect(table.search({ keyword: 'new' })).rejects.toThrow('failed')
    expect(table.loading.value).toBe(false)
    expect(table.list.value).toEqual([])
    expect(table.total.value).toBe(0)
    expect(onError).toHaveBeenCalledWith(error)

    request.mockResolvedValueOnce({ rows: [{ id: 1 }], total: 1 })
    await table.reset()
    expect(table.query).toMatchObject({ keyword: 'old' })
    expect(table.list.value).toEqual([{ id: 1 }])
  })

  it('ignores stale table responses and aborts the previous request by default', async () => {
    const jobs = [
      deferred<{ rows: Array<{ id: number }>; total: number }>(),
      deferred<{
        rows: Array<{ id: number }>
        total: number
      }>()
    ]
    const signals: Array<AbortSignal | undefined> = []
    const request = vi.fn((_: unknown, context: { signal?: AbortSignal }) => {
      signals.push(context.signal)
      return jobs[signals.length - 1].promise
    })
    const table = useTable<{ id: number }>({ request, immediate: false })

    const firstLoad = table.load()
    const secondLoad = table.setPage(2)
    expect(signals[0]?.aborted).toBe(true)

    jobs[1].resolve({ rows: [{ id: 2 }], total: 1 })
    await secondLoad
    jobs[0].resolve({ rows: [{ id: 1 }], total: 1 })
    await firstLoad

    expect(table.list.value).toEqual([{ id: 2 }])
    expect(table.loading.value).toBe(false)
  })

  it('settles an aborted table request without reporting it as a business error', async () => {
    const onError = vi.fn()
    const request = vi.fn(
      (_: unknown, { signal }: { signal?: AbortSignal }) =>
        new Promise<{ rows: Array<{ id: number }>; total: number }>((_, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        })
    )
    const table = useTable<{ id: number }>({ request, immediate: false, onError })

    const loading = table.load()
    table.cancel()

    await expect(loading).resolves.toMatchObject({ list: [], total: 0 })
    expect(table.error.value).toBeUndefined()
    expect(onError).not.toHaveBeenCalled()
  })

  it('transforms table params and keeps existing data when refresh fails', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 1 }], total: 1 })
      .mockRejectedValueOnce(new Error('refresh failed'))
    const table = useTable<{ id: number }, { keyword?: string }>({
      request,
      immediate: false,
      initialQuery: { keyword: 'admin' },
      transformParams: (params) => ({
        keyword: params.keyword,
        page: params.pageNum,
        size: params.pageSize
      })
    })

    await table.load()
    await expect(table.refresh()).rejects.toThrow('refresh failed')

    expect(request).toHaveBeenLastCalledWith(
      { keyword: 'admin', page: 1, size: 10 },
      expect.objectContaining({ requestId: expect.any(Number) })
    )
    expect(table.list.value).toEqual([{ id: 1 }])
    expect(table.total.value).toBe(1)
  })

  it('manages modal state', () => {
    const modal = useModal<{ id: number }>()

    modal.open({ id: 1 }, 'edit')
    expect(modal.visible.value).toBe(true)
    expect(modal.mode.value).toBe('edit')
    expect(modal.payload.value).toEqual({ id: 1 })

    modal.setConfirmLoading(true)
    modal.close(true)
    expect(modal.visible.value).toBe(false)
    expect(modal.confirmLoading.value).toBe(false)
    expect(modal.payload.value).toBeUndefined()
  })

  it('loads and caches dictionaries', async () => {
    const loader = vi.fn(async () => [{ label: '正常', value: '0' }])
    const dict = useDict({ loader })

    await dict.load('sys_normal_disable')
    await dict.load('sys_normal_disable')

    expect(loader).toHaveBeenCalledTimes(1)
    expect(dict.getLabel('sys_normal_disable', '0')).toBe('正常')
    expect(dict.getLabel('sys_normal_disable', '1', '未知')).toBe('未知')
  })

  it('tracks table selection by row key', () => {
    const selection = useSelection<{ id: number }>((row) => row.id)

    selection.toggle({ id: 1 })
    selection.toggle({ id: 2 })
    selection.toggle({ id: 1 }, false)

    expect(selection.selectedKeys.value).toEqual([2])
    expect(selection.hasSelection.value).toBe(true)
  })

  it('runs an async action once while locked and exposes its lifecycle', async () => {
    const job = deferred<number>()
    const onSuccess = vi.fn()
    const action = vi.fn(() => job.promise)
    const state = useAsyncAction({ action, onSuccess })

    const firstRun = state.execute()
    const secondRun = state.execute()
    expect(firstRun).toBe(secondRun)
    await Promise.resolve()
    expect(action).toHaveBeenCalledTimes(1)
    expect(state.loading.value).toBe(true)
    expect(state.status.value).toBe('running')

    job.resolve(7)
    await firstRun
    expect(state.loading.value).toBe(false)
    expect(state.status.value).toBe('success')
    expect(state.result.value).toBe(7)
    expect(onSuccess).toHaveBeenCalledWith(7, [])
  })

  it('supports async action guards and handled errors', async () => {
    const action = vi.fn().mockRejectedValue(new Error('save failed'))
    const before = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const state = useAsyncAction({ action, before, throwOnError: false })

    await expect(state.run()).resolves.toBeUndefined()
    expect(state.status.value).toBe('cancelled')
    expect(action).not.toHaveBeenCalled()

    await expect(state.run()).resolves.toBeUndefined()
    expect(state.status.value).toBe('error')
    expect(state.error.value).toEqual(new Error('save failed'))
  })
})
