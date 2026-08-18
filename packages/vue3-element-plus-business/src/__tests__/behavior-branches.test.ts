import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AsyncButton from '../components/AsyncButton.vue'
import FormDialog from '../components/FormDialog.vue'
import ImportDialog from '../components/ImportDialog.vue'
import Permission from '../components/Permission.vue'
import TableToolbar from '../components/TableToolbar.vue'
import {
  checkPermission,
  createPermissionDirective,
  permissionProviderKey,
  providePermission
} from '../permission'
import { Vue3ElementPlusBusiness } from '../index'

const wrappers: Array<ReturnType<typeof mount>> = []
const track = <T extends ReturnType<typeof mount>>(wrapper: T): T => {
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  localStorage.clear()
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
})

describe('Vue3 guarded business behaviors', () => {
  it('handles AsyncButton host confirmation, guards, failures and external locks', async () => {
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const notifyError = vi.fn()
    const telemetry = vi.fn()
    const action = vi.fn().mockResolvedValueOnce('saved').mockRejectedValueOnce(new Error('failed'))
    const beforeAction = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const wrapper = track(
      mount(AsyncButton, {
        props: { action, confirm: 'Continue?', beforeAction },
        global: { plugins: [[Vue3ElementPlusBusiness, { confirm, notifyError, telemetry }]] }
      })
    )

    await expect(wrapper.vm.execute('confirm-cancel')).resolves.toBeUndefined()
    await expect(wrapper.vm.execute('guard-cancel')).resolves.toBeUndefined()
    expect(action).not.toHaveBeenCalled()
    await expect(wrapper.vm.execute('ok')).resolves.toBe('saved')
    await expect(wrapper.vm.execute('bad')).rejects.toThrow('failed')
    expect(notifyError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: 'AsyncButton' })
    )
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({ phase: 'error' }))
    expect(wrapper.emitted('cancel')).toHaveLength(2)

    await wrapper.setProps({ loading: true })
    await expect(wrapper.vm.execute('locked')).resolves.toBeUndefined()
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('validates, submits and closes FormDialog through every guard', async () => {
    let release!: (value: string) => void
    const submit = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve
        })
    )
    const beforeClose = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const confirmClose = vi.fn().mockResolvedValue(true)
    const wrapper = track(
      mount(FormDialog, {
        props: {
          modelValue: true,
          model: { name: 'Old' },
          submit,
          beforeClose,
          confirmClose
        }
      })
    )
    wrapper.vm.innerModel.name = 'New'
    await nextTick()
    await expect(wrapper.vm.requestClose('cancel')).resolves.toBe(false)

    const task = wrapper.vm.submitForm()
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    await expect(wrapper.vm.requestClose('close')).resolves.toBe(false)
    release('saved')
    await expect(task).resolves.toBe('saved')
    expect(wrapper.emitted('success')?.at(-1)?.[0]).toBe('saved')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])

    wrapper.vm.innerModel.name = 'Again'
    await nextTick()
    await expect(wrapper.vm.requestClose('cancel')).resolves.toBe(true)
    expect(confirmClose).toHaveBeenCalled()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('returns models without submit callbacks and propagates submit errors', async () => {
    const plain = track(mount(FormDialog, { props: { modelValue: true, model: { id: 1 } } }))
    await expect(plain.vm.submitForm()).resolves.toEqual({ id: 1 })

    const failed = track(
      mount(FormDialog, {
        props: {
          modelValue: true,
          model: { id: 2 },
          submit: async () => {
            throw new Error('save failed')
          },
          closeOnSuccess: false
        }
      })
    )
    await expect(failed.vm.submitForm()).rejects.toThrow('save failed')
    expect(failed.emitted('error')?.at(-1)?.[0]).toEqual(expect.any(Error))
    failed.vm.resetFields()
    await nextTick()
    expect(failed.emitted('reset')).toHaveLength(1)
  })

  it('validates import files, rejects hooks, retries failures and downloads templates', async () => {
    const templateDownload = vi
      .fn()
      .mockRejectedValueOnce(new Error('template failed'))
      .mockResolvedValueOnce(undefined)
    const beforeImport = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('import failed'))
      .mockImplementationOnce(async (context) => {
        context.onProgress(125)
        return { message: 'Done', successCount: 1, failureCount: 0 }
      })
    const wrapper = track(
      mount(ImportDialog, {
        props: {
          modelValue: true,
          request,
          beforeImport,
          templateDownload,
          showUpdateExisting: true,
          maxSizeMb: 0.001,
          closeOnSuccess: true,
          data: (_file: File, updateExisting: boolean) => ({ updateExisting })
        }
      })
    )

    await expect(wrapper.vm.submit()).resolves.toBeUndefined()
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'config' })
    wrapper.vm.handleFileChange({ raw: new File(['x'], 'bad.txt', { type: 'text/plain' }) })
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'type' })
    wrapper.vm.handleFileChange({ raw: new File([new Uint8Array(2048)], 'large.xlsx') })
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'size' })

    await wrapper.setProps({ maxSizeMb: 1 })
    wrapper.vm.handleFileChange({ raw: new File(['sheet'], 'users.xlsx') })
    await expect(wrapper.vm.submit()).resolves.toBeUndefined()
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({
      code: 'before-import'
    })
    await expect(wrapper.vm.submit()).rejects.toThrow('import failed')
    expect(wrapper.vm.status).toBe('error')
    await expect(wrapper.vm.submit()).resolves.toMatchObject({ successCount: 1 })
    expect(wrapper.vm.percentage).toBe(100)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])

    const templateButton = wrapper
      .findAllComponents({ name: 'ElButton' })
      .find((button) => button.text().includes('下载模板'))!
    await templateButton.trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('template-error')).toHaveLength(1))
    await templateButton.trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('template-success')).toHaveLength(1))
    wrapper.vm.clear()
    expect(wrapper.vm.selectedFile).toBeUndefined()
  })

  it('updates toolbar columns and handles storage/fullscreen boundaries', async () => {
    localStorage.setItem('amusite:table-toolbar:broken', '{broken')
    const target = document.createElement('div')
    target.id = 'table-target'
    document.body.appendChild(target)
    const wrapper = track(
      mount(TableToolbar, {
        attachTo: document.body,
        props: {
          columns: [
            { prop: 'name', label: 'Name' },
            { prop: 'status', label: 'Status', visible: false },
            { prop: 'fixed', label: 'Fixed', columnSetting: false }
          ],
          storageKey: 'broken',
          fullscreenTarget: '#table-target'
        }
      })
    )

    wrapper.vm.refresh()
    wrapper.vm.updateAllColumns(false)
    wrapper.vm.resetColumns()
    wrapper.vm.changeDensity('invalid' as never)
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    expect(wrapper.emitted('update:columns')).toHaveLength(2)
    expect(wrapper.emitted('update:density')).toBeUndefined()

    await wrapper.vm.toggleFullscreen()
    expect(wrapper.emitted('fullscreen-error')).toHaveLength(1)
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(target, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen
    })
    await wrapper.vm.toggleFullscreen()
    expect(requestFullscreen).toHaveBeenCalled()

    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: target })
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen })
    document.dispatchEvent(new Event('fullscreenchange'))
    await nextTick()
    await wrapper.vm.toggleFullscreen()
    expect(exitFullscreen).toHaveBeenCalled()
    expect(wrapper.emitted('fullscreen-change')?.at(-1)).toEqual([true])
  })

  it('updates and unmounts permission directives and renders fallbacks', () => {
    const provider = { getPermissions: () => ['read', 'write'] }
    const directive = createPermissionDirective(provider) as {
      mounted?: (element: HTMLElement, binding: unknown) => void
      updated?: (element: HTMLElement, binding: unknown) => void
      unmounted?: (element: HTMLElement, binding: unknown) => void
    }
    const element = document.createElement('button')
    element.style.display = 'inline-block'
    directive.mounted?.(element, { value: ['read', 'write'], modifiers: { all: true } } as never)
    expect(element.style.display).toBe('inline-block')
    directive.updated?.(element, { value: 'missing', modifiers: {} } as never)
    expect(element.style.display).toBe('none')
    directive.updated?.(element, {
      value: { permission: 'read', match: 'any' },
      modifiers: {}
    } as never)
    expect(element.style.display).toBe('inline-block')
    directive.updated?.(element, { value: undefined, modifiers: { all: false } } as never)
    expect(element.style.display).toBe('inline-block')
    directive.unmounted?.(element, {} as never)

    const fallback = track(
      mount(Permission, {
        props: { permission: 'missing', tag: 'div' },
        slots: { fallback: '<span class="fallback">Denied</span>' },
        global: { provide: { [permissionProviderKey as symbol]: provider } }
      })
    )
    expect(fallback.find('.fallback').exists()).toBe(true)
    expect(checkPermission({ permission: 'read' }, provider)).toBe(true)
    const provide = vi.fn()
    providePermission({ provide } as never, provider)
    expect(provide).toHaveBeenCalledWith(permissionProviderKey, provider)
  })
})
