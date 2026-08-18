import { mount } from '@vue/test-utils'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ExportButton from '../components/ExportButton.vue'
import Loading from '../components/Loading.vue'
import Pagination from '../components/Pagination.vue'
import ProTable from '../components/ProTable.vue'
import QueryForm from '../components/QueryForm.vue'

const wrappers: Array<ReturnType<typeof mount>> = []
const track = <T extends ReturnType<typeof mount>>(wrapper: T): T => {
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.style.overflow = ''
})

describe('Vue3 core business components', () => {
  it('normalizes split query ranges and exposes query/reset/toggle methods', async () => {
    const model = { keyword: 'admin', created: ['2026-01-01', '2026-01-31'] }
    const wrapper = track(
      mount(QueryForm, {
        props: {
          model,
          maxRows: 1,
          breakpointCols: { lg: 1 },
          fields: [
            { prop: 'keyword', label: 'Keyword' },
            { prop: 'created', label: 'Created', valueMode: 'split-range' }
          ]
        }
      })
    )

    expect(wrapper.vm.innerModel).toMatchObject({
      keyword: 'admin',
      createdStart: '2026-01-01',
      createdEnd: '2026-01-31'
    })
    expect(wrapper.vm.innerModel).not.toHaveProperty('created')
    wrapper.vm.query()
    expect(wrapper.emitted('query')?.at(-1)?.[0]).toMatchObject({ keyword: 'admin' })
    wrapper.vm.innerModel.keyword = 'changed'
    await nextTick()
    wrapper.vm.reset()
    await nextTick()
    expect(wrapper.vm.innerModel.keyword).toBe('admin')
    expect(wrapper.emitted('reset')).toHaveLength(1)
    wrapper.vm.toggleExpand()
    expect(wrapper.vm.expanded).toBe(true)
  })

  it('forwards table columns, pagination models and slot scopes', async () => {
    const wrapper = track(
      mount(ProTable, {
        props: {
          data: [{ id: 1, name: 'Ada' }],
          columns: [
            { prop: 'id', label: 'ID', visible: false },
            { prop: 'name', label: 'Name', slotName: 'name' }
          ],
          size: 'mini',
          page: 2,
          limit: 20,
          total: 40
        },
        slots: { name: ({ row }: { row: { name: string } }) => h('strong', row.name) }
      })
    )

    expect(wrapper.classes()).toContain('x-pro-table--mini')
    expect(wrapper.findAllComponents({ name: 'ElTableColumn' })).toHaveLength(1)
    const pagination = wrapper.findComponent(Pagination)
    pagination.vm.$emit('update:page', 3)
    pagination.vm.$emit('update:limit', 50)
    pagination.vm.$emit('pagination', { page: 3, limit: 50 })
    await nextTick()
    expect(wrapper.emitted('update:page')?.at(-1)).toEqual([3])
    expect(wrapper.emitted('update:limit')?.at(-1)).toEqual([50])
    expect(wrapper.emitted('pagination')?.at(-1)).toEqual([{ page: 3, limit: 50 }])
  })

  it('resets pagination when a larger page size exceeds total and scrolls', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const wrapper = track(mount(Pagination, { props: { total: 25, page: 2, limit: 10 } }))
    const pagination = wrapper.findComponent({ name: 'ElPagination' })

    pagination.vm.$emit('size-change', 20)
    pagination.vm.$emit('current-change', 3)
    await nextTick()

    expect(wrapper.emitted('update:page')?.at(-1)).toEqual([1])
    expect(wrapper.emitted('pagination')).toEqual([
      [{ page: 1, limit: 20 }],
      [{ page: 3, limit: 10 }]
    ])
    expect(scrollTo).toHaveBeenCalled()
  })

  it('honors loading delay, minimum duration and fullscreen body locking', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const wrapper = track(
      mount(Loading, {
        attachTo: document.body,
        props: { loading: true, delay: 50, minDuration: 100, fullscreen: true }
      })
    )

    expect(wrapper.vm.displayedLoading).toBe(false)
    vi.advanceTimersByTime(50)
    await nextTick()
    expect(wrapper.vm.displayedLoading).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    await wrapper.setProps({ loading: false })
    vi.advanceTimersByTime(99)
    expect(wrapper.vm.displayedLoading).toBe(true)
    vi.advanceTimersByTime(1)
    await nextTick()
    expect(wrapper.vm.displayedLoading).toBe(false)
    expect(document.body.style.overflow).toBe('')
    expect(wrapper.emitted('change')?.map((event) => event[0])).toEqual([true, false])
  })

  it('transforms and downloads exports through the explicit adapter', async () => {
    const download = vi.fn()
    const wrapper = track(
      mount(ExportButton, {
        props: {
          request: vi.fn().mockResolvedValue('csv-content'),
          transformResult: (result: unknown) => ({ data: String(result), type: 'text/csv' }),
          fileName: (_file, ...args: unknown[]) => `${String(args[0])}.csv`,
          download
        }
      })
    )

    await expect(wrapper.vm.execute('users')).resolves.toMatchObject({
      data: 'csv-content',
      fileName: 'users.csv',
      type: 'text/csv'
    })
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'users.csv' }),
      'users'
    )
    expect(wrapper.emitted('download')?.at(-1)?.[0]).toMatchObject({ fileName: 'users.csv' })
  })

  it('renders browser-safe components with Vue SSR', async () => {
    const app = createSSRApp({
      render: () => h(Loading, { loading: true }, { default: () => 'content' })
    })
    await expect(renderToString(app)).resolves.toContain('aria-busy="true"')
  })
})
