// @vitest-environment jsdom

import Vue from 'vue'
import ElementUI from 'element-ui'
import { mount, type Wrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AsyncButton from './AsyncButton'
import DictTag from './DictTag'
import ExportButton from './ExportButton'
import ImportDialog from './ImportDialog'
import Loading from './Loading'
import Pagination from './Pagination'
import ProTable from './ProTable'
import QueryForm from './QueryForm'
import Permission, { configurePermission, PermissionDirective } from './Permission'
import { scrollTo } from '../utils/scrollTo'

Vue.use(ElementUI)

const wrappers: Array<Wrapper<Vue>> = []
function track<T extends Vue>(wrapper: Wrapper<T>): Wrapper<T> {
  wrappers.push(wrapper as unknown as Wrapper<Vue>)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.destroy())
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.style.overflow = ''
})

describe('Vue2 core component contracts', () => {
  it('normalizes query ranges, breakpoints, slots and reset state', async () => {
    const wrapper = track(
      mount(QueryForm, {
        propsData: {
          model: { keyword: 'admin', created: ['2026-01-01', '2026-01-31'] },
          maxRows: 1,
          breakpointCols: { xs: 1, sm: 2, md: 1, lg: 1, xl: 4 },
          fields: [
            { prop: 'keyword', label: 'Keyword' },
            {
              prop: 'created',
              label: 'Created',
              valueMode: 'split-range',
              component: 'el-date-picker'
            },
            { prop: 'custom', label: 'Custom', slotName: 'custom', layout: 'radio-group' },
            { prop: 'hidden', label: 'Hidden', visible: false }
          ]
        },
        scopedSlots: {
          custom:
            '<button class="custom-field" @click="props.update(\'yes\')">{{ props.value || \'custom\' }}</button>'
        }
      })
    ) as Wrapper<Vue & Record<string, any>>

    expect(wrapper.vm.innerModel).toMatchObject({
      keyword: 'admin',
      createdStart: '2026-01-01',
      createdEnd: '2026-01-31'
    })
    expect(wrapper.vm.visibleFields).toHaveLength(3)
    expect(wrapper.vm.shouldShowToggle).toBe(true)
    expect(wrapper.vm.visibleRows).toHaveLength(1)
    expect(wrapper.text()).toContain('展开')
    expect(wrapper.find('.custom-field').exists()).toBe(false)

    wrapper.vm.toggleExpand()
    await Vue.nextTick()
    expect(wrapper.vm.visibleRows).toHaveLength(3)
    await wrapper.find('.custom-field').trigger('click')
    expect(wrapper.vm.innerModel.custom).toBe('yes')

    wrapper.vm.handleFieldInput(wrapper.vm.fields[1], ['', null])
    expect(wrapper.vm.getFieldValue(wrapper.vm.fields[1])).toEqual([])
    expect(wrapper.vm.getFieldFormProp(wrapper.vm.fields[1])).toBe('createdStart')
    expect(wrapper.vm.getMergedComponentProps(wrapper.vm.fields[0])).toMatchObject({
      clearable: true
    })
    expect(
      wrapper.vm.getMergedComponentProps({
        component: 'span',
        componentProps: { clearable: false }
      })
    ).toEqual({ clearable: false })
    expect(wrapper.vm.getFieldSpan({ colSpan: 99 })).toBe(24)

    wrapper.vm.windowWidth = 700
    expect(wrapper.vm.activeBreakpoint).toBe('xs')
    wrapper.vm.windowWidth = 800
    expect(wrapper.vm.activeBreakpoint).toBe('sm')
    wrapper.vm.windowWidth = 1000
    expect(wrapper.vm.activeBreakpoint).toBe('md')
    wrapper.vm.windowWidth = 1300
    expect(wrapper.vm.activeBreakpoint).toBe('lg')
    wrapper.vm.windowWidth = 2000
    expect(wrapper.vm.activeBreakpoint).toBe('xl')

    wrapper.vm.innerModel.keyword = 'changed'
    wrapper.vm.handleQuery()
    expect(wrapper.emitted('query')?.at(-1)?.[0]).toMatchObject({ keyword: 'changed' })
    wrapper.vm.handleReset()
    await Vue.nextTick()
    expect(wrapper.vm.innerModel.keyword).toBe('admin')
    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('renders visible table columns and forwards pagination events', async () => {
    const wrapper = track(
      mount(ProTable, {
        propsData: {
          data: [{ id: 1, name: 'Ada' }],
          columns: [
            { type: 'selection', key: 'select' },
            { prop: 'name', label: 'Name', slotName: 'name', headerSlotName: 'nameHeader' },
            { prop: 'hidden', label: 'Hidden', visible: false }
          ],
          total: 1,
          page: 1,
          limit: 20,
          loading: true,
          loadingProps: { text: 'Loading users' }
        },
        scopedSlots: {
          name: '<strong class="name-cell">{{ props.row && props.row.name }}</strong>',
          nameHeader: '<span class="name-header">{{ props.columnConfig.label }}</span>'
        }
      })
    ) as Wrapper<Vue & Record<string, any>>

    expect(wrapper.vm.visibleColumns).toHaveLength(2)
    expect(wrapper.vm.shouldShowPagination).toBe(true)
    expect(wrapper.vm.resolveShowOverflowTooltip({ type: 'selection' })).toBe(false)
    expect(wrapper.vm.resolveShowOverflowTooltip({ prop: 'name' })).toBe(true)
    expect(
      wrapper.vm.resolveShowOverflowTooltip({ prop: 'name', showOverflowTooltip: false })
    ).toBe(false)
    expect(
      wrapper.vm.getColumnAttrs({ prop: 'name', visible: true, unknown: undefined })
    ).toMatchObject({
      prop: 'name',
      showOverflowTooltip: true
    })
    expect(wrapper.vm.getColumnKey({}, 2)).toBe('column-2')

    wrapper.vm.handleUpdatePage(2)
    wrapper.vm.handleUpdateLimit(50)
    wrapper.vm.handlePagination({ page: 2, limit: 50 })
    expect(wrapper.emitted('update:page')?.at(-1)).toEqual([2])
    expect(wrapper.emitted('update:limit')?.at(-1)).toEqual([50])
    expect(wrapper.emitted('pagination')?.at(-1)).toEqual([{ page: 2, limit: 50 }])

    await wrapper.setProps({ showPagination: false })
    expect(wrapper.vm.shouldShowPagination).toBe(false)
    await wrapper.setProps({ showPagination: true, paginationHiddenWhenNoData: false, total: 0 })
    expect(wrapper.vm.shouldShowPagination).toBe(true)
  })

  it('keeps pagination update and request payloads consistent', () => {
    const wrapper = track(
      mount(Pagination, {
        propsData: { total: 25, page: 2, limit: 10, autoScroll: false, hidden: true }
      })
    ) as Wrapper<Vue & Record<string, any>>

    expect(wrapper.classes()).toContain('hidden')
    wrapper.vm.currentPage = 3
    wrapper.vm.pageSize = 50
    wrapper.vm.handleSizeChange(20)
    wrapper.vm.handleCurrentChange(3)

    expect(wrapper.emitted('update:page')).toEqual([[3], [1]])
    expect(wrapper.emitted('update:limit')).toEqual([[50]])
    expect(wrapper.emitted('pagination')).toEqual([
      [{ page: 1, limit: 20 }],
      [{ page: 3, limit: 10 }]
    ])
  })

  it('renders loading masks and unlocks fullscreen state on destroy', async () => {
    const wrapper = track(
      mount(Loading, {
        attachTo: document.body,
        propsData: { loading: true, fullscreen: true, text: 'Loading data', size: 'large' },
        slots: { default: '<div class="content">content</div>' }
      })
    ) as Wrapper<Vue & Record<string, any>>

    expect(wrapper.find('.x-loading__mask').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading data')
    expect(wrapper.text()).toContain('content')
    expect(document.body.style.overflow).toBe('hidden')
    await wrapper.setProps({ loading: false })
    expect(wrapper.find('.x-loading__mask').exists()).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })

  it('animates the shared scroll helper to its target', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const scroll = vi.fn()
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      setTimeout(() => {
        vi.setSystemTime(Date.now() + 50)
        callback(Date.now())
      }, 0)
      return 1
    })
    const container = { pageYOffset: 100, scrollTo: scroll } as unknown as Window

    scrollTo(0, 100, container)
    vi.runAllTimers()
    expect(frame).toHaveBeenCalled()
    expect(scroll).toHaveBeenLastCalledWith(0, 0)
  })

  it('covers dictionary fallback, strict matching and custom tag content', async () => {
    const empty = track(mount(DictTag, { propsData: { value: '', emptyText: 'None' } }))
    expect(empty.text()).toBe('None')

    const wrapper = track(
      mount(DictTag, {
        propsData: {
          value: [0, 'missing'],
          strict: true,
          separator: ' / ',
          fallback: (value: unknown) => `Unknown:${value}`,
          options: [{ label: 'Zero', value: 0, color: '#fff', className: 'zero' }]
        },
        scopedSlots: {
          default:
            '<button class="tag-slot" @click="$emit(\'selected\', props.value)">{{ props.label }}</button>'
        }
      })
    ) as Wrapper<Vue & Record<string, any>>

    expect(wrapper.text()).toContain('Zero')
    expect(wrapper.text()).toContain('Unknown:missing')
    expect(wrapper.text()).toContain('/')
    expect(wrapper.vm.findOption('0')).toBeUndefined()
    expect(wrapper.vm.resolveFallback('x')).toBe('Unknown:x')
    await wrapper.setProps({ fallback: 'Unknown' })
    expect(wrapper.vm.resolveFallback('x')).toBe('Unknown')
    await wrapper.setProps({ fallback: undefined })
    expect(wrapper.vm.resolveFallback('x')).toBe('x')
  })

  it('handles confirmation adapters, guards, errors and external button loading', async () => {
    const action = vi.fn().mockResolvedValueOnce('saved').mockRejectedValueOnce('failed')
    const beforeAction = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
    const wrapper = track(
      mount(AsyncButton, {
        propsData: { action, confirm: true, beforeAction },
        mocks: { $confirm: vi.fn().mockResolvedValue(true) }
      })
    ) as Wrapper<Vue & Record<string, any>>

    await expect(wrapper.vm.execute('guarded')).resolves.toBeUndefined()
    expect(action).not.toHaveBeenCalled()
    await expect(wrapper.vm.execute('ok')).resolves.toBe('saved')
    expect(action).toHaveBeenCalledWith('ok')
    await expect(wrapper.vm.execute('bad')).rejects.toBe('failed')
    expect(wrapper.emitted('error')).toHaveLength(1)
    expect(wrapper.vm.getErrorMessage('plain')).toBe('plain')
    expect(wrapper.vm.getErrorMessage({})).toBe('Operation failed')

    await wrapper.setProps({ confirm: () => false })
    await expect(wrapper.vm.execute('cancel')).resolves.toBeUndefined()
    expect(wrapper.emitted('cancel')?.at(-1)).toEqual(['cancel'])
    await wrapper.setProps({ loading: true })
    await expect(wrapper.vm.execute('locked')).resolves.toBeUndefined()
  })

  it('renders and validates every import dialog state', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('import offline'))
      .mockResolvedValueOnce({
        successCount: 2,
        failureCount: 1,
        errors: [{ row: 3, message: 'Invalid row' }]
      })
    const templateDownload = vi.fn().mockResolvedValue(undefined)
    const beforeImport = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const wrapper = track(
      mount(ImportDialog, {
        propsData: {
          value: true,
          request,
          beforeImport,
          templateDownload,
          showUpdateExisting: true,
          updateExisting: true,
          maxSizeMb: 0.001,
          closeOnSuccess: true
        }
      })
    ) as Wrapper<Vue & Record<string, any>>

    await expect(wrapper.vm.submit()).resolves.toBeUndefined()
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'config' })
    wrapper.vm.handleFileChange({ raw: new File(['x'], 'invalid.txt', { type: 'text/plain' }) })
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'type' })
    wrapper.vm.handleFileChange({ raw: new File([new Uint8Array(2048)], 'large.xlsx') })
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'size' })

    await wrapper.setProps({ maxSizeMb: 1 })
    const file = new File(['sheet'], 'users.xlsx')
    wrapper.vm.handleFileChange({ raw: file })
    expect(wrapper.vm.selectedFile).toBe(file)
    await expect(wrapper.vm.submit()).resolves.toBeUndefined()
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({
      code: 'before-import'
    })

    await expect(wrapper.vm.submit()).rejects.toThrow('import offline')
    expect(wrapper.vm.status).toBe('error')
    expect(wrapper.vm.errorMessage).toBe('import offline')
    await expect(wrapper.vm.submit()).resolves.toMatchObject({ successCount: 2, failureCount: 1 })
    await Vue.nextTick()
    expect(wrapper.text()).toContain('Invalid row')
    expect(wrapper.emitted('input')?.at(-1)).toEqual([false])

    wrapper.vm.handleUpdateExisting(false)
    expect(wrapper.emitted('update:updateExisting')?.at(-1)).toEqual([false])
    await wrapper.vm.handleTemplateDownload()
    expect(wrapper.emitted('template-success')).toHaveLength(1)
    const done = vi.fn()
    wrapper.vm.status = 'uploading'
    wrapper.vm.handleBeforeClose(done)
    expect(done).not.toHaveBeenCalled()
    wrapper.vm.status = 'ready'
    wrapper.vm.handleBeforeClose(done)
    expect(done).toHaveBeenCalled()
    wrapper.vm.handleCancel()
    wrapper.vm.handleClosed()
    expect(wrapper.vm.selectedFile).toBeUndefined()
  })

  it('normalizes permission directive values and restores prior display styles', async () => {
    configurePermission({ getPermissions: () => ['read', 'write'] })
    const element = document.createElement('button')
    element.style.display = 'inline-flex'
    PermissionDirective.inserted?.(
      element,
      { value: ['read', 'write'], modifiers: { all: true } } as any,
      {} as any,
      {} as any
    )
    expect(element.style.display).toBe('inline-flex')
    PermissionDirective.componentUpdated?.(
      element,
      { value: { permission: 'missing', match: 'any' }, modifiers: {} } as any,
      {} as any,
      {} as any
    )
    expect(element.style.display).toBe('none')
    PermissionDirective.unbind?.(element, {} as any, {} as any, {} as any)

    const denied = track(
      mount(Permission, {
        propsData: { permission: 'missing', tag: 'div' },
        slots: { fallback: ['<span class="first">one</span>', '<span class="second">two</span>'] }
      })
    )
    expect(denied.classes()).toContain('x-permission--hidden')
    expect(denied.text()).toContain('one')

    const allowed = track(
      mount(Permission, {
        propsData: { permission: ['read', 'write'], match: 'all', tag: 'section' },
        slots: { default: ['<span>one</span>', '<span>two</span>'] }
      })
    )
    expect(allowed.classes()).toContain('x-permission')
    expect(allowed.text()).toContain('two')
  })

  it('normalizes export results with and without automatic download', async () => {
    const download = vi.fn()
    const wrapper = track(
      mount(ExportButton, {
        propsData: {
          request: async () => new Blob(['csv'], { type: 'text/csv' }),
          fileName: (_file: unknown, name: string) => `${name}.csv`,
          autoDownload: false
        }
      })
    ) as Wrapper<Vue & Record<string, any>>

    await expect(wrapper.vm.runExport('users')).resolves.toMatchObject({ fileName: 'users.csv' })
    expect(download).not.toHaveBeenCalled()

    await wrapper.setProps({
      request: async () => 'raw',
      transformResult: async () => ({ data: 'transformed', fileName: 'server.csv' }),
      autoDownload: true,
      download
    })
    await expect(wrapper.vm.runExport('users')).resolves.toMatchObject({
      data: 'transformed',
      fileName: 'server.csv'
    })
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'server.csv' }),
      'users'
    )
    expect(wrapper.emitted('download')).toHaveLength(1)
  })
})
