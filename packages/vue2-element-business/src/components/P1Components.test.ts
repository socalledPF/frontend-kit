// @vitest-environment jsdom

import Vue from 'vue'
import ElementUI from 'element-ui'
import { mount, type Wrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  checkPermission,
  configurePermission,
  Descriptions as ExportedDescriptions,
  ExportButton as ExportedExportButton,
  FormDialog as ExportedFormDialog,
  ImportDialog as ExportedImportDialog,
  Permission as ExportedPermission,
  PermissionDirective,
  Vue2ElementBusiness,
  XDescriptions,
  XExportButton,
  XFormDialog,
  XImportDialog,
  XPermission
} from '../index'
import Descriptions from './Descriptions'
import ExportButton from './ExportButton'
import FormDialog from './FormDialog'
import ImportDialog from './ImportDialog'
import Permission from './Permission'

Vue.use(ElementUI)

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

interface FormDialogVm extends Vue {
  innerModel: Record<string, unknown>
  dirty: boolean
  submitting: boolean
  submitForm: () => Promise<unknown>
  requestClose: (reason?: string) => Promise<boolean>
  resetFields: () => void
}

interface ImportDialogVm extends Vue {
  selectedFile?: File
  status: string
  percentage: number
  result?: Record<string, unknown>
  handleFileChange: (file: { raw: File }) => void
  submit: () => Promise<Record<string, unknown> | undefined>
  abort: () => void
}

interface ExportButtonVm extends Vue {
  execute: (...args: unknown[]) => Promise<unknown>
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

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.destroy())
  configurePermission({})
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('P1 business components', () => {
  it('protects dirty FormDialog data and locks duplicate submissions', async () => {
    const job = deferred<{ id: number }>()
    const submit = vi.fn(() => job.promise)
    const confirmClose = vi.fn(async () => false)
    const wrapper = track(
      mount(FormDialog, {
        propsData: {
          value: true,
          model: { name: 'old' },
          submit,
          confirmClose
        },
        scopedSlots: {
          default: '<el-form-item prop="name"><el-input /></el-form-item>'
        }
      }) as unknown as Wrapper<FormDialogVm>
    )

    await Vue.nextTick()
    wrapper.vm.innerModel.name = 'new'
    await Vue.nextTick()
    expect(wrapper.vm.dirty).toBe(true)
    await expect(wrapper.vm.requestClose('cancel')).resolves.toBe(false)
    expect(confirmClose).toHaveBeenCalledWith(expect.objectContaining({ dirty: true }))
    expect(wrapper.emitted('input')).toBeUndefined()

    const first = wrapper.vm.submitForm()
    const second = wrapper.vm.submitForm()
    expect(first).toBe(second)
    await flushPromises()
    expect(wrapper.vm.submitting).toBe(true)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith(
      { name: 'new' },
      expect.objectContaining({ mode: 'create', model: { name: 'new' } })
    )

    job.resolve({ id: 7 })
    await expect(first).resolves.toEqual({ id: 7 })
    expect(wrapper.emitted('success')?.[0]?.[0]).toEqual({ id: 7 })
    expect(wrapper.emitted('input')?.at(-1)).toEqual([false])
  })

  it('restores the opening FormDialog model when reset', async () => {
    const wrapper = track(
      mount(FormDialog, {
        propsData: { value: true, model: { name: 'original' } }
      }) as unknown as Wrapper<FormDialogVm>
    )
    await Vue.nextTick()
    wrapper.vm.innerModel.name = 'temporary'
    await Vue.nextTick()
    expect(wrapper.vm.dirty).toBe(true)

    wrapper.vm.resetFields()
    await Vue.nextTick()

    expect(wrapper.vm.innerModel).toEqual({ name: 'original' })
    expect(wrapper.vm.dirty).toBe(false)
    expect(wrapper.emitted('update:model')?.at(-1)).toEqual([{ name: 'original' }])
    expect(wrapper.emitted('reset')?.at(-1)).toEqual([{ name: 'original' }])
  })

  it('validates permission and role requirements for component and directive usage', () => {
    configurePermission({
      getPermissions: () => ['system:user:list', 'system:user:add'],
      getRoles: () => ['operator']
    })

    expect(
      checkPermission({ permission: ['system:user:list', 'system:user:add'], match: 'all' })
    ).toBe(true)
    expect(checkPermission({ permission: 'system:user:remove' })).toBe(false)
    expect(checkPermission({ roles: 'operator' })).toBe(true)

    const allowed = track(
      mount(Permission, {
        propsData: { permission: 'system:user:add' },
        slots: { default: '<button class="add-user">新增</button>' }
      })
    )
    const denied = track(
      mount(Permission, {
        propsData: { permission: 'system:user:remove' },
        slots: { default: '<button class="remove-user">删除</button>' }
      })
    )

    expect(allowed.find('.add-user').exists()).toBe(true)
    expect(denied.find('.remove-user').exists()).toBe(false)

    const button = document.createElement('button')
    PermissionDirective.inserted?.(
      button,
      { value: 'system:user:remove', modifiers: {} } as any,
      {} as any,
      {} as any
    )
    expect(button.style.display).toBe('none')
  })

  it('renders nested, dictionary, formatted and slotted description values', () => {
    const wrapper = track(
      mount(Descriptions, {
        propsData: {
          data: {
            user: { name: 'admin' },
            status: '0',
            amount: 12.5,
            remark: ''
          },
          items: [
            { prop: 'user.name', label: '名称' },
            {
              prop: 'status',
              label: '状态',
              dictOptions: [{ label: '正常', value: '0', type: 'success' }]
            },
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

  it('imports one file with progress and exposes the normalized result', async () => {
    const request = vi.fn(async (context) => {
      context.onProgress(48)
      return {
        successCount: 2,
        failureCount: 1,
        errors: [{ row: 3, message: '用户名不能为空' }]
      }
    })
    const wrapper = track(
      mount(ImportDialog, {
        propsData: { value: true, request, showUpdateExisting: true }
      }) as unknown as Wrapper<ImportDialogVm>
    )
    const file = new File(['name\nadmin'], 'users.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    wrapper.vm.handleFileChange({ raw: file })
    const result = await wrapper.vm.submit()
    await Vue.nextTick()

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ file, fieldName: 'file', updateExisting: false })
    )
    expect(wrapper.vm.percentage).toBe(100)
    expect(wrapper.vm.status).toBe('success')
    expect(result).toEqual(expect.objectContaining({ successCount: 2, failureCount: 1 }))
    expect(wrapper.text()).toContain('第 3 行：用户名不能为空')
  })

  it('ignores a late import response after cancellation', async () => {
    const job = deferred<{ successCount: number }>()
    const wrapper = track(
      mount(ImportDialog, {
        propsData: { value: true, request: () => job.promise }
      }) as unknown as Wrapper<ImportDialogVm>
    )
    wrapper.vm.handleFileChange({ raw: new File(['x'], 'users.xlsx') })

    const task = wrapper.vm.submit()
    await flushPromises()
    expect(wrapper.vm.status).toBe('uploading')
    wrapper.vm.abort()
    job.resolve({ successCount: 1 })
    await expect(task).resolves.toBeUndefined()

    expect(wrapper.vm.status).toBe('ready')
    expect(wrapper.vm.result).toBeUndefined()
    expect(wrapper.emitted('success')).toBeUndefined()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('downloads ExportButton results with a host-provided downloader', async () => {
    const download = vi.fn()
    const request = vi.fn(async (query: unknown) => ({
      data: new Blob(['report']),
      fileName: 'users.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      query
    }))
    const wrapper = track(
      mount(ExportButton, {
        propsData: { request, download },
        slots: { default: '导出用户' }
      }) as unknown as Wrapper<ExportButtonVm>
    )

    const result = await wrapper.vm.execute({ status: '0' })
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'users.xlsx', data: expect.any(Blob) }),
      { status: '0' }
    )
    expect(result).toEqual(expect.objectContaining({ fileName: 'users.xlsx' }))
    expect(wrapper.emitted('download')).toHaveLength(1)
  })

  it('exports and registers every P1 component and the permission directive', () => {
    const component = vi.fn()
    const directive = vi.fn()

    ;(Vue2ElementBusiness.install as any)({ component, directive })

    expect(ExportedFormDialog).toBe(FormDialog)
    expect(ExportedPermission).toBe(Permission)
    expect(ExportedDescriptions).toBe(Descriptions)
    expect(ExportedImportDialog).toBe(ImportDialog)
    expect(ExportedExportButton).toBe(ExportButton)
    expect(XFormDialog).toBe(FormDialog)
    expect(XPermission).toBe(Permission)
    expect(XDescriptions).toBe(Descriptions)
    expect(XImportDialog).toBe(ImportDialog)
    expect(XExportButton).toBe(ExportButton)
    expect(component).toHaveBeenCalledWith('XFormDialog', FormDialog)
    expect(component).toHaveBeenCalledWith('XPermission', Permission)
    expect(component).toHaveBeenCalledWith('XDescriptions', Descriptions)
    expect(component).toHaveBeenCalledWith('XImportDialog', ImportDialog)
    expect(component).toHaveBeenCalledWith('XExportButton', ExportButton)
    expect(directive).toHaveBeenCalledWith('permission', PermissionDirective)
  })
})
