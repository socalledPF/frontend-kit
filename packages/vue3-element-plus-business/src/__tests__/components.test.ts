import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  AsyncButton,
  Descriptions,
  DictSelect,
  DictTag,
  FormDialog,
  Permission,
  TableToolbar,
  Vue3ElementPlusBusiness,
  XAsyncButton,
  XDataTable,
  XFormDialog,
  XImportDialog,
  XLoading,
  XPagination,
  XPermission,
  XProTable,
  XQueryForm,
  XSearchForm,
  XUpload
} from '../index'

const wrappers: Array<ReturnType<typeof mount>> = []
const track = <T extends ReturnType<typeof mount>>(wrapper: T): T => {
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('Vue3 business components', () => {
  it('locks AsyncButton and emits its lifecycle', async () => {
    let resolve!: (value: number) => void
    const action = vi.fn(
      () =>
        new Promise<number>((done) => {
          resolve = done
        })
    )
    const wrapper = track(
      mount(AsyncButton, {
        props: { action, confirm: async () => true },
        slots: { default: '保存' }
      })
    )
    const first = wrapper.vm.execute('payload')
    const second = wrapper.vm.execute('ignored')
    expect(first).toBe(second)
    await Promise.resolve()
    await Promise.resolve()
    expect(action).toHaveBeenCalledTimes(1)
    resolve(8)
    await first
    expect(wrapper.emitted('loading-change')?.map((event) => event[0])).toEqual([true, false])
    expect(wrapper.emitted('success')?.[0]).toEqual([8, 'payload'])
  })

  it('uses modelValue for DictSelect and renders loose dictionary matches', async () => {
    const select = track(
      mount(DictSelect, {
        props: {
          modelValue: '',
          options: [
            { label: '正常', value: '0' },
            { label: '停用', value: '1', disabled: true }
          ]
        }
      })
    )
    select.findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', '0')
    await nextTick()
    expect(select.emitted('update:modelValue')?.[0]).toEqual(['0'])

    const tags = track(
      mount(DictTag, {
        props: {
          value: [0, '1'],
          options: [
            { label: '正常', value: '0', type: 'success' },
            { label: '停用', value: '1', type: 'danger' }
          ]
        }
      })
    )
    expect(tags.text()).toContain('正常')
    expect(tags.text()).toContain('停用')
  })

  it('protects dirty FormDialog data and resets to its opening snapshot', async () => {
    const confirmClose = vi.fn(async () => false)
    const wrapper = track(
      mount(FormDialog, {
        props: { modelValue: true, model: { name: 'old' }, confirmClose },
        slots: { default: '<span />' }
      })
    )
    await nextTick()
    wrapper.vm.innerModel.name = 'new'
    await nextTick()
    expect(wrapper.vm.dirty).toBe(true)
    await expect(wrapper.vm.requestClose('cancel')).resolves.toBe(false)
    expect(confirmClose).toHaveBeenCalledWith(expect.objectContaining({ dirty: true }))
    wrapper.vm.resetFields()
    await nextTick()
    expect(wrapper.vm.innerModel).toEqual({ name: 'old' })
    expect(wrapper.emitted('update:model')?.at(-1)).toEqual([{ name: 'old' }])
  })

  it('renders nested, dictionary, formatted and empty description values', () => {
    const wrapper = track(
      mount(Descriptions, {
        props: {
          data: { user: { name: 'admin' }, status: '0', amount: 12.5, remark: '' },
          items: [
            { prop: 'user.name', label: '名称' },
            { prop: 'status', label: '状态', dictOptions: [{ label: '正常', value: '0' }] },
            { prop: 'amount', label: '金额', formatter: (value: unknown) => `¥${value}` },
            { prop: 'remark', label: '备注' }
          ]
        }
      })
    )
    expect(wrapper.text()).toContain('admin')
    expect(wrapper.text()).toContain('正常')
    expect(wrapper.text()).toContain('¥12.5')
    expect(wrapper.text()).toContain('--')
  })

  it('injects permissions per app and applies the directive provider', () => {
    const Host = {
      template:
        '<div><Permission permission="user:add"><button class="allowed">新增</button></Permission><button v-permission="\'user:remove\'" class="denied">删除</button></div>',
      components: { Permission }
    }
    const wrapper = track(
      mount(Host, {
        global: {
          plugins: [
            [Vue3ElementPlusBusiness, { permission: { getPermissions: () => ['user:add'] } }]
          ]
        }
      })
    )
    expect(wrapper.find('.allowed').exists()).toBe(true)
    expect((wrapper.find('.denied').element as HTMLElement).style.display).toBe('none')
  })

  it('persists TableToolbar density and column preferences', async () => {
    const wrapper = track(
      mount(TableToolbar, {
        props: {
          columns: [
            { prop: 'name', label: '名称' },
            { prop: 'status', label: '状态', visible: false }
          ],
          storageKey: 'users',
          showFullscreen: false
        }
      })
    )
    wrapper.vm.updateColumnVisibility('status', true)
    wrapper.vm.changeDensity('mini')
    await nextTick()
    expect(wrapper.emitted('update:density')?.at(-1)).toEqual(['mini'])
    expect(wrapper.emitted('update:columns')?.at(-1)?.[0]).toEqual([
      expect.objectContaining({ prop: 'name' }),
      expect.objectContaining({ prop: 'status', visible: true })
    ])
    expect(JSON.parse(localStorage.getItem('amusite:table-toolbar:users') || '{}')).toMatchObject({
      density: 'mini'
    })
  })

  it('exports aliases and registers all components', () => {
    const component = vi.fn()
    const directive = vi.fn()
    const provide = vi.fn()
    Vue3ElementPlusBusiness.install({ component, directive, provide } as never)
    expect([
      XSearchForm,
      XDataTable,
      XQueryForm,
      XProTable,
      XPagination,
      XLoading,
      XUpload,
      XAsyncButton,
      XFormDialog,
      XPermission,
      XImportDialog
    ]).toHaveLength(11)
    expect(component).toHaveBeenCalledWith('XQueryForm', XQueryForm)
    expect(component).toHaveBeenCalledWith('XUpload', XUpload)
    expect(component).toHaveBeenCalledWith('FormDialog', XFormDialog)
    expect(directive).toHaveBeenCalledWith('permission', expect.any(Object))
  })
})
