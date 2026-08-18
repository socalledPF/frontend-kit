import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DrawerForm from '../components/DrawerForm.vue'
import EditableTable from '../components/EditableTable.vue'
import FilePreview from '../components/FilePreview.vue'
import RemoteSelect from '../components/RemoteSelect.vue'
import StatusSwitch from '../components/StatusSwitch.vue'
import { Vue3ElementPlusBusiness } from '../index'

const wrappers: Array<ReturnType<typeof mount>> = []
const track = <T extends ReturnType<typeof mount>>(wrapper: T): T => {
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:preview-1')
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn()
  })
})

describe('Vue3 product components', () => {
  it('loads, caches, refreshes and reports remote select options', async () => {
    const request = vi.fn(async (keyword: string) => [
      { label: keyword || 'All', value: keyword || 'all' }
    ])
    const wrapper = track(mount(RemoteSelect, { props: { request, debounce: 0 } }))

    await expect(wrapper.vm.load(' admin ')).resolves.toEqual([{ label: 'admin', value: 'admin' }])
    await wrapper.vm.load('admin')
    expect(request).toHaveBeenCalledTimes(1)
    await wrapper.vm.refresh('admin')
    expect(request).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('load')?.at(-1)).toEqual([[{ label: 'admin', value: 'admin' }], 'admin'])

    wrapper.vm.clearCache('admin')
    await wrapper.vm.load('admin')
    expect(request).toHaveBeenCalledTimes(3)
    await wrapper.setProps({ minChars: 5, options: [{ label: 'Fallback', value: 'fallback' }] })
    await expect(wrapper.vm.load('a')).resolves.toEqual([{ label: 'Fallback', value: 'fallback' }])
  })

  it('keeps prior remote options after a request error', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ label: 'Ready', value: 1 }])
      .mockRejectedValueOnce(new Error('offline'))
    const wrapper = track(mount(RemoteSelect, { props: { request } }))

    await wrapper.vm.load('ok')
    await expect(wrapper.vm.refresh('failed')).rejects.toThrow('offline')
    expect(wrapper.vm.options).toEqual([{ label: 'Ready', value: 1 }])
    expect(wrapper.emitted('error')?.at(-1)?.[1]).toBe('failed')
    expect(wrapper.emitted('loading-change')?.map((event) => event[0])).toEqual([
      true,
      false,
      true,
      false
    ])
  })

  it('ignores stale remote results and supports uncached invalid payloads', async () => {
    let resolveFirst!: (value: Array<{ label: string; value: string }>) => void
    let resolveSecond!: (value: Array<{ label: string; value: string }>) => void
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve
          })
      )
      .mockResolvedValueOnce(null)
    const wrapper = track(
      mount(RemoteSelect, { props: { request, cache: false, loadOnFocus: false } })
    )

    const first = wrapper.vm.load('first')
    const second = wrapper.vm.load('second')
    resolveFirst([{ label: 'Old', value: 'old' }])
    resolveSecond([{ label: 'New', value: 'new' }])
    await Promise.all([first, second])
    expect(wrapper.vm.options).toEqual([{ label: 'New', value: 'new' }])
    await expect(wrapper.vm.load('invalid')).resolves.toEqual([])
    wrapper.vm.clearCache()
  })

  it('submits drawer forms once and protects dirty close attempts', async () => {
    const submit = vi.fn(async () => 'saved')
    const confirmClose = vi.fn(async () => false)
    const wrapper = track(
      mount(DrawerForm, {
        props: { modelValue: true, model: { name: 'Old' }, submit, confirmClose }
      })
    )

    wrapper.vm.innerModel.name = 'New'
    await nextTick()
    expect(wrapper.vm.dirty).toBe(true)
    await expect(wrapper.vm.requestClose('cancel')).resolves.toBe(false)
    expect(confirmClose).toHaveBeenCalledWith(
      expect.objectContaining({ dirty: true, reason: 'cancel' })
    )

    const first = wrapper.vm.submitForm()
    const second = wrapper.vm.submitForm()
    expect(first).toBe(second)
    await expect(first).resolves.toBe('saved')
    expect(submit).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('success')?.at(-1)?.[0]).toBe('saved')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('returns plain drawer models, honors beforeClose and reports submit failures', async () => {
    const beforeClose = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
    const wrapper = track(
      mount(DrawerForm, {
        props: { modelValue: true, model: { id: 1 }, beforeClose, closeOnSuccess: false }
      })
    )
    await expect(wrapper.vm.requestClose('close')).resolves.toBe(false)
    await expect(wrapper.vm.submitForm()).resolves.toEqual({ id: 1 })
    await expect(wrapper.vm.requestClose('cancel')).resolves.toBe(true)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.vm.resetFields()
    await nextTick()
    expect(wrapper.emitted('reset')).toHaveLength(1)

    const failed = track(
      mount(DrawerForm, {
        props: {
          modelValue: true,
          model: { id: 2 },
          submit: async () => {
            throw new Error('drawer failed')
          }
        }
      })
    )
    await expect(failed.vm.submitForm()).rejects.toThrow('drawer failed')
    expect(failed.emitted('error')?.at(-1)?.[0]).toEqual(expect.any(Error))
  })

  it('adds, edits, removes and resets editable rows within limits', async () => {
    const wrapper = track(
      mount(EditableTable, {
        props: {
          modelValue: [{ id: 1, name: 'One' }],
          columns: [{ prop: 'name', label: 'Name', editable: true }],
          createRow: () => ({ id: 2, name: 'Two' }),
          minRows: 1,
          maxRows: 2
        }
      })
    )

    wrapper.vm.addRow()
    expect(wrapper.vm.rows).toHaveLength(2)
    wrapper.vm.addRow()
    expect(wrapper.vm.rows).toHaveLength(2)
    wrapper.vm.removeRow(0)
    expect(wrapper.vm.rows).toHaveLength(1)
    wrapper.vm.removeRow(0)
    expect(wrapper.vm.rows).toHaveLength(1)
    wrapper.vm.startEdit(wrapper.vm.rows[0], 0, 'name')
    wrapper.vm.stopEdit()
    wrapper.vm.reset([{ id: 3, name: 'Three' }])
    await nextTick()
    expect(wrapper.vm.rows).toEqual([{ id: 3, name: 'Three' }])
    const changes = wrapper.emitted('change') as Array<[unknown, { type: string }]>
    expect(changes.map((event) => event[1].type)).toEqual(['add', 'remove', 'reset'])
    await expect(wrapper.vm.validate()).resolves.toBe(true)
  })

  it('confirms status changes and rolls optimistic failures back', async () => {
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const request = vi.fn().mockRejectedValue(new Error('save failed'))
    const wrapper = track(
      mount(StatusSwitch, {
        props: { modelValue: false, confirm, request, optimistic: true }
      })
    )

    await wrapper.vm.update(true)
    expect(wrapper.emitted('cancel')?.at(-1)).toEqual([true, false])
    await wrapper.vm.update(true)
    expect(request).toHaveBeenCalledWith(true, false)
    expect(wrapper.emitted('rollback')?.at(-1)).toEqual([false, true])
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
    expect(wrapper.emitted('loading-change')?.map((event) => event[0])).toEqual([true, false])
  })

  it('supports non-optimistic status updates', async () => {
    const wrapper = track(
      mount(StatusSwitch, {
        props: {
          modelValue: '0',
          activeValue: '1',
          inactiveValue: '0',
          optimistic: false,
          request: async () => 'ok'
        }
      })
    )
    await wrapper.vm.update('1')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['1'])
    expect(wrapper.emitted('success')?.at(-1)).toEqual(['ok', '1', '0'])
  })

  it('uses host status confirmation and ignores updates while disabled or loading', async () => {
    const confirm = vi.fn().mockResolvedValue(true)
    let release!: () => void
    const request = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    const wrapper = track(
      mount(StatusSwitch, {
        props: { modelValue: false, confirm: true, request },
        global: { plugins: [[Vue3ElementPlusBusiness, { confirm }]] }
      })
    )
    const running = wrapper.vm.update(true)
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    await wrapper.vm.update(false)
    expect(request).toHaveBeenCalledTimes(1)
    release()
    await running
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }))

    await wrapper.setProps({ disabled: true })
    await wrapper.vm.update(false)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('loads text previews, exposes kind detection and releases object URLs', async () => {
    const loadText = vi.fn().mockResolvedValue('hello preview')
    const download = vi.fn()
    const wrapper = track(
      mount(FilePreview, {
        attachTo: document.body,
        props: {
          modelValue: true,
          file: { name: 'notes.txt', type: 'text/plain', data: new Blob(['hello']) },
          loadText,
          download
        }
      })
    )
    await vi.waitFor(() => expect(loadText).toHaveBeenCalled())
    await nextTick()

    expect(wrapper.vm.kind).toBe('text')
    expect(wrapper.vm.sourceUrl).toBe('blob:preview-1')
    expect(document.body.textContent).toContain('hello preview')
    await wrapper.vm.download()
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ name: 'notes.txt' }))
    wrapper.vm.close()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1')
  })

  it('detects common media and unsupported preview kinds', async () => {
    const wrapper = track(
      mount(FilePreview, {
        props: { modelValue: false, file: { name: 'manual.pdf' } }
      })
    )
    expect(wrapper.vm.kind).toBe('pdf')
    await wrapper.setProps({ file: { name: 'clip.mp4' } })
    expect(wrapper.vm.kind).toBe('video')
    await wrapper.setProps({ file: { name: 'sound.mp3' } })
    expect(wrapper.vm.kind).toBe('audio')
    await wrapper.setProps({ file: { name: 'archive.zip' } })
    expect(wrapper.vm.kind).toBe('unsupported')
  })

  it('reports preview and download failures and supports explicit preview kinds', async () => {
    const notifyError = vi.fn()
    const wrapper = track(
      mount(FilePreview, {
        props: {
          modelValue: true,
          kind: 'text',
          file: { name: 'remote.data', url: '/file' },
          loadText: async () => {
            throw new Error('preview failed')
          },
          download: async () => {
            throw new Error('download failed')
          }
        },
        global: { plugins: [[Vue3ElementPlusBusiness, { notifyError }]] }
      })
    )
    await vi.waitFor(() => expect(wrapper.emitted('error')).toHaveLength(1))
    await wrapper.vm.download()
    expect(wrapper.emitted('error')?.at(-1)).toEqual([expect.any(Error), 'download'])
    expect(notifyError).toHaveBeenCalledTimes(2)
    await wrapper.setProps({ text: 'provided' })
    await wrapper.vm.reload()
    expect(wrapper.vm.kind).toBe('text')
  })
})
