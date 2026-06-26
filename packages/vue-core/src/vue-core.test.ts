import { describe, expect, it, vi } from 'vitest'
import { useDict, useModal, useSelection, useTable } from './index'

describe('@amusite/vue-core', () => {
  it('loads RuoYi table data and handles pagination', async () => {
    const request = vi.fn(async (params: { name?: string; pageNum?: number; pageSize?: number }) => ({
      code: 200,
      rows: [{ id: params.pageNum ?? 1, name: params.name ?? '' }],
      total: 2
    }))
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
    expect(request).toHaveBeenLastCalledWith({ name: 'admin', pageNum: 2, pageSize: 10 })
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
})
