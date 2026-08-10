// @vitest-environment jsdom

import Vue from 'vue'
import ElementUI from 'element-ui'
import { mount, type Wrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AsyncButton as ExportedAsyncButton,
  DictSelect as ExportedDictSelect,
  DictTag as ExportedDictTag,
  TableToolbar as ExportedTableToolbar,
  Vue2ElementBusiness,
  XAsyncButton,
  XDictSelect,
  XDictTag,
  XTableToolbar
} from '../index'
import AsyncButton from './AsyncButton'
import DictSelect from './DictSelect'
import DictTag from './DictTag'
import TableToolbar from './TableToolbar'

Vue.use(ElementUI)

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

interface AsyncButtonVm extends Vue {
  displayedLoading: boolean
  execute: (...args: unknown[]) => Promise<unknown>
}

interface TableToolbarVm extends Vue {
  toggleSearch: () => void
  refresh: () => void
  changeDensity: (density: string) => void
  updateColumnVisibility: (key: string, visible: boolean) => void
}

const wrappers: Array<Wrapper<Vue>> = []

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function track<T extends Vue>(wrapper: Wrapper<T>): Wrapper<T> {
  wrappers.push(wrapper as unknown as Wrapper<Vue>)
  return wrapper
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Vue.nextTick()
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.destroy())
  document.body.innerHTML = ''
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('P0 business components', () => {
  it('locks AsyncButton while an action is running and emits its lifecycle', async () => {
    const job = deferred<number>()
    const confirm = vi.fn(async () => true)
    const action = vi.fn(() => job.promise)
    const wrapper = track(
      mount(AsyncButton, {
        propsData: { action, confirm },
        slots: { default: '保存' }
      }) as unknown as Wrapper<AsyncButtonVm>
    )

    const firstRun = wrapper.vm.execute('payload')
    const secondRun = wrapper.vm.execute('ignored')
    expect(firstRun).toBe(secondRun)
    await flushPromises()

    expect(confirm).toHaveBeenCalledWith('payload')
    expect(action).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.displayedLoading).toBe(true)

    job.resolve(8)
    await firstRun
    await Vue.nextTick()
    expect(wrapper.vm.displayedLoading).toBe(false)
    expect(wrapper.emitted('loading-change')?.map((event) => event[0])).toEqual([true, false])
    expect(wrapper.emitted('success')?.[0]).toEqual([8, 'payload'])
  })

  it('cancels AsyncButton before invoking its action', async () => {
    const action = vi.fn()
    const wrapper = track(
      mount(AsyncButton, {
        propsData: { action, confirm: async () => false }
      }) as unknown as Wrapper<AsyncButtonVm>
    )

    await expect(wrapper.vm.execute('delete')).resolves.toBeUndefined()
    expect(action).not.toHaveBeenCalled()
    expect(wrapper.emitted('cancel')?.[0]).toEqual(['delete'])
  })

  it('renders dictionary tags with loose value matching and multiple values', () => {
    const wrapper = track(
      mount(DictTag, {
        propsData: {
          value: [0, '1'],
          options: [
            { label: '正常', value: '0', type: 'success' },
            { label: '停用', value: '1', type: 'danger' }
          ]
        }
      })
    )

    expect(wrapper.findAll('.el-tag')).toHaveLength(2)
    expect(wrapper.text()).toContain('正常')
    expect(wrapper.text()).toContain('停用')
  })

  it('forwards DictSelect model changes and option state', async () => {
    const wrapper = track(
      mount(DictSelect, {
        propsData: {
          value: '',
          options: [
            { label: '正常', value: '0' },
            { label: '停用', value: '1', disabled: true }
          ]
        }
      })
    )
    const select = wrapper.findComponent({ name: 'ElSelect' })

    select.vm.$emit('input', '0')
    select.vm.$emit('change', '0')
    await Vue.nextTick()

    expect(wrapper.emitted('input')?.[0]).toEqual(['0'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['0'])
    expect(wrapper.findAllComponents({ name: 'ElOption' }).at(1).props('disabled')).toBe(true)
  })

  it('updates and persists TableToolbar preferences through events', async () => {
    const columns = [
      { prop: 'name', label: '名称' },
      { prop: 'status', label: '状态', visible: false },
      { type: 'selection', columnSetting: false }
    ]
    const wrapper = track(
      mount(TableToolbar, {
        propsData: {
          columns,
          storageKey: 'users',
          showFullscreen: false
        }
      }) as unknown as Wrapper<TableToolbarVm>
    )

    wrapper.vm.toggleSearch()
    wrapper.vm.refresh()
    wrapper.vm.updateColumnVisibility('status', true)
    wrapper.vm.changeDensity('mini')
    await Vue.nextTick()

    expect(wrapper.emitted('update:showSearch')?.[0]).toEqual([false])
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    expect(wrapper.emitted('update:columns')?.at(-1)?.[0]).toEqual([
      expect.objectContaining({ prop: 'name' }),
      expect.objectContaining({ prop: 'status', visible: true }),
      expect.objectContaining({ type: 'selection' })
    ])
    expect(wrapper.emitted('update:density')?.at(-1)).toEqual(['mini'])
    expect(JSON.parse(window.localStorage.getItem('amusite:table-toolbar:users') || '{}')).toEqual({
      density: 'mini',
      columns: { name: true, status: true, 'column-2': true }
    })
  })

  it('restores persisted TableToolbar density and columns on mount', async () => {
    window.localStorage.setItem(
      'amusite:table-toolbar:orders',
      JSON.stringify({ density: 'mini', columns: { name: false } })
    )
    const wrapper = track(
      mount(TableToolbar, {
        propsData: {
          columns: [{ prop: 'name', label: '名称' }],
          storageKey: 'orders',
          showFullscreen: false
        }
      }) as unknown as Wrapper<TableToolbarVm>
    )
    await Vue.nextTick()

    expect(wrapper.emitted('update:density')?.[0]).toEqual(['mini'])
    expect(wrapper.emitted('update:columns')?.[0]?.[0]).toEqual([
      expect.objectContaining({ prop: 'name', visible: false })
    ])
  })

  it('renders TableToolbar scoped action slots', () => {
    const wrapper = track(
      mount(TableToolbar, {
        propsData: { showFullscreen: false },
        scopedSlots: {
          left: '<button class="custom-left-action">新增</button>',
          right: '<span class="custom-right-action">已选择 2 项</span>'
        }
      })
    )

    expect(wrapper.find('.custom-left-action').exists()).toBe(true)
    expect(wrapper.find('.custom-right-action').exists()).toBe(true)
  })

  it('exports and registers every P0 component name', () => {
    const component = vi.fn()

    ;(Vue2ElementBusiness.install as any)({ component })

    expect(ExportedAsyncButton).toBe(AsyncButton)
    expect(ExportedDictTag).toBe(DictTag)
    expect(ExportedDictSelect).toBe(DictSelect)
    expect(ExportedTableToolbar).toBe(TableToolbar)
    expect(XAsyncButton).toBe(AsyncButton)
    expect(XDictTag).toBe(DictTag)
    expect(XDictSelect).toBe(DictSelect)
    expect(XTableToolbar).toBe(TableToolbar)
    expect(component).toHaveBeenCalledWith('XAsyncButton', AsyncButton)
    expect(component).toHaveBeenCalledWith('XDictTag', DictTag)
    expect(component).toHaveBeenCalledWith('XDictSelect', DictSelect)
    expect(component).toHaveBeenCalledWith('XTableToolbar', TableToolbar)
  })
})
