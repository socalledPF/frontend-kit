import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { UploadItem, UploadRequestContext } from '@amusite/business-core'
import ImportDialog from '../components/ImportDialog.vue'
import Upload from '../components/Upload.vue'

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }
const deferred = <T>(): Deferred<T> => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await nextTick(); await new Promise((resolve) => setTimeout(resolve, 0)) }
const file = (name: string, size = 32, type = 'text/plain') => new File([new Uint8Array(size)], name, { type, lastModified: 1_700_000_000_000 })
const wrappers: Array<ReturnType<typeof mount>> = []
afterEach(() => { wrappers.splice(0).forEach((wrapper) => wrapper.unmount()); document.body.innerHTML = ''; vi.restoreAllMocks() })
beforeEach(() => {
  let index = 0
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:upload-${++index}`) })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})

describe('Upload and ImportDialog', () => {
  it('uploads automatically, reports progress, and updates only successful items', async () => {
    const request = vi.fn(async ({ file: raw, onProgress }: UploadRequestContext) => { onProgress(46.4); return { id: 'file-1', name: raw.name, url: `/uploads/${raw.name}` } })
    const wrapper = mount(Upload, { props: { modelValue: [], request, multiple: true } }); wrappers.push(wrapper)
    await wrapper.vm.handleElementChange({ raw: file('report.pdf', 128, 'application/pdf') }); await flush()
    expect(wrapper.emitted('progress')?.[0]?.[0]).toMatchObject({ percentage: 46 })
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([expect.objectContaining({ id: 'file-1', name: 'report.pdf', size: 128 })])
    expect(wrapper.vm.files[0].status).toBe('success')
  })

  it('limits concurrency and preserves selection order', async () => {
    const jobs = new Map<string, Deferred<UploadItem>>()
    const request = vi.fn(({ file: raw }: UploadRequestContext) => { const job = deferred<UploadItem>(); jobs.set(raw.name, job); return job.promise })
    const wrapper = mount(Upload, { props: { modelValue: [], request, multiple: true, concurrency: 2 } }); wrappers.push(wrapper)
    await wrapper.vm.handleElementChange({ raw: file('first.txt') }); await wrapper.vm.handleElementChange({ raw: file('second.txt') }); await wrapper.vm.handleElementChange({ raw: file('third.txt') })
    expect(request).toHaveBeenCalledTimes(2)
    jobs.get('second.txt')?.resolve({ name: 'second.txt', url: '/second' }); await flush(); expect(request).toHaveBeenCalledTimes(3)
    jobs.get('third.txt')?.resolve({ name: 'third.txt', url: '/third' }); jobs.get('first.txt')?.resolve({ name: 'first.txt', url: '/first' }); await flush()
    expect((wrapper.emitted('update:modelValue')?.at(-1)?.[0] as UploadItem[]).map((item) => item.name)).toEqual(['first.txt', 'second.txt', 'third.txt'])
  })

  it('keeps a previous single item until replacement succeeds and ignores canceled results', async () => {
    const first = deferred<UploadItem>(); const second = deferred<UploadItem>()
    const request = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = mount(Upload, { props: { modelValue: [{ uid: 'old', id: 1, name: 'old.pdf', url: '/old' }], request } }); wrappers.push(wrapper)
    await wrapper.vm.handleElementChange({ raw: file('new.pdf') })
    first.reject(new Error('failed')); await flush()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    const pending = wrapper.vm.files.find((item: { name: string; uid: string }) => item.name === 'new.pdf')!
    wrapper.vm.retry(pending.uid); second.resolve({ id: 2, name: 'new.pdf', url: '/new' }); await flush()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([expect.objectContaining({ id: 2 })])

    const late = deferred<UploadItem>(); await wrapper.setProps({ autoUpload: false, request: () => late.promise }); await wrapper.vm.handleElementChange({ raw: file('late.pdf') }); wrapper.vm.submit(); await flush(); const lateFile = wrapper.vm.files.find((item: { name: string; uid: string }) => item.name === 'late.pdf')!; wrapper.vm.abort(lateFile.uid); late.resolve({ name: 'late.pdf', url: '/late' }); await flush()
    expect(wrapper.vm.files.find((item: { name: string; status: string }) => item.name === 'late.pdf')?.status).toBe('ready')
  })

  it('validates files and revokes image preview URLs', async () => {
    const wrapper = mount(Upload, { props: { modelValue: [], request: vi.fn(), mode: 'image', multiple: true, accept: 'image/*', maxSizeMb: .001 } }); wrappers.push(wrapper)
    await wrapper.vm.handleElementChange({ raw: file('notes.txt') })
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'type' })
    await wrapper.vm.handleElementChange({ raw: file('large.png', 2048, 'image/png') })
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'size' })
    await wrapper.setProps({ maxSizeMb: 1, autoUpload: false }); await wrapper.vm.handleElementChange({ raw: file('avatar.png', 128, 'image/png') })
    await wrapper.vm.remove(wrapper.vm.files[0].uid)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:upload-1')
  })

  it('imports with progress and ignores a late response after cancellation', async () => {
    const first = vi.fn(async (context) => { context.onProgress(48); return { successCount: 2, failureCount: 1, errors: [{ row: 3, message: '用户名不能为空' }] } })
    const wrapper = mount(ImportDialog, { props: { modelValue: true, request: first } }); wrappers.push(wrapper)
    const source = file('users.xlsx')
    wrapper.vm.handleFileChange({ raw: source }); const result = await wrapper.vm.submit(); await nextTick()
    expect(result).toMatchObject({ successCount: 2, failureCount: 1 })
    expect(wrapper.vm.percentage).toBe(100)
    expect(wrapper.text()).toContain('第 3 行：用户名不能为空')

    const late = deferred<{ successCount: number }>(); await wrapper.setProps({ request: () => late.promise }); wrapper.vm.handleFileChange({ raw: source }); const task = wrapper.vm.submit(); await flush(); wrapper.vm.abort(); late.resolve({ successCount: 1 }); await expect(task).resolves.toBeUndefined()
    expect(wrapper.vm.status).toBe('ready')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
