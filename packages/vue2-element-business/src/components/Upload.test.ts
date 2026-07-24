// @vitest-environment jsdom

import Vue from 'vue'
import ElementUI from 'element-ui'
import { mount, type Wrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Upload as ExportedUpload, Vue2ElementBusiness, XUpload } from '../index'
import type { UploadBeforeRemove, UploadItem, UploadRequest, UploadRequestContext } from '../types'
import Upload from './Upload'

Vue.use(ElementUI)

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

interface UploadVm extends Vue {
  files: Array<{
    uid: string
    name: string
    status: string
    percentage: number
  }>
  activeCount: number
  previewVisible: boolean
  selectorHidden: boolean
  handleElementChange: (file: { raw: File }) => Promise<void>
  submit: () => void
  retry: (uid: string) => void
  abort: (uid?: string) => void
  clear: () => void
  remove: (uid: string) => Promise<void>
  openPreview: (file: unknown) => void
}

const wrappers: Array<Wrapper<UploadVm>> = []
let objectUrlIndex = 0

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createFile(name: string, size = 32, type = 'text/plain'): File {
  return new File([new Uint8Array(size)], name, {
    type,
    lastModified: 1_700_000_000_000
  })
}

function mountUpload(propsData: Record<string, unknown>): Wrapper<UploadVm> {
  const wrapper = mount(Upload, {
    attachTo: document.body,
    propsData: {
      value: [],
      ...propsData
    }
  }) as unknown as Wrapper<UploadVm>
  wrappers.push(wrapper)
  return wrapper
}

async function selectFile(wrapper: Wrapper<UploadVm>, file: File): Promise<void> {
  await wrapper.vm.handleElementChange({ raw: file })
  await flushPromises()
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Vue.nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function latestInput(wrapper: Wrapper<UploadVm>): UploadItem[] | undefined {
  return wrapper.emitted('input')?.at(-1)?.[0] as UploadItem[] | undefined
}

beforeEach(() => {
  objectUrlIndex = 0
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => `blob:x-upload-${++objectUrlIndex}`)
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn()
  })
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.destroy())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Upload', () => {
  it('uploads automatically, reports progress, and emits successful items', async () => {
    const request = vi.fn(async ({ file, onProgress }: UploadRequestContext) => {
      onProgress(46.4)
      return { id: 'file-1', name: file.name, url: `/uploads/${file.name}` }
    })
    const wrapper = mountUpload({ request, multiple: true })

    await selectFile(wrapper, createFile('report.pdf', 128, 'application/pdf'))

    expect(request).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('progress')?.[0]?.[0]).toMatchObject({ percentage: 46 })
    expect(latestInput(wrapper)).toEqual([
      expect.objectContaining({
        id: 'file-1',
        name: 'report.pdf',
        url: '/uploads/report.pdf',
        size: 128,
        type: 'application/pdf'
      })
    ])
    expect(wrapper.vm.files[0].status).toBe('success')
  })

  it('limits concurrency while preserving selection order', async () => {
    const jobs = new Map<string, Deferred<UploadItem>>()
    const request = vi.fn(({ file }: UploadRequestContext) => {
      const job = deferred<UploadItem>()
      jobs.set(file.name, job)
      return job.promise
    })
    const wrapper = mountUpload({ request, multiple: true, concurrency: 2 })

    await selectFile(wrapper, createFile('first.txt'))
    await selectFile(wrapper, createFile('second.txt'))
    await selectFile(wrapper, createFile('third.txt'))

    expect(request).toHaveBeenCalledTimes(2)
    jobs.get('second.txt')?.resolve({ name: 'second.txt', url: '/second.txt' })
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(3)

    jobs.get('third.txt')?.resolve({ name: 'third.txt', url: '/third.txt' })
    jobs.get('first.txt')?.resolve({ name: 'first.txt', url: '/first.txt' })
    await flushPromises()

    expect(latestInput(wrapper)?.map((item) => item.name)).toEqual([
      'first.txt',
      'second.txt',
      'third.txt'
    ])
  })

  it('keeps the previous single value until its replacement succeeds', async () => {
    const firstAttempt = deferred<UploadItem>()
    const secondAttempt = deferred<UploadItem>()
    const request = vi
      .fn<UploadRequest>()
      .mockReturnValueOnce(firstAttempt.promise)
      .mockReturnValueOnce(secondAttempt.promise)
    const existing: UploadItem = {
      uid: 'existing',
      id: 'old',
      name: 'old.pdf',
      url: '/old.pdf'
    }
    const wrapper = mountUpload({ request, value: [existing] })

    await selectFile(wrapper, createFile('new.pdf', 64, 'application/pdf'))
    expect(wrapper.vm.files.map((file) => file.name)).toEqual(['old.pdf', 'new.pdf'])

    firstAttempt.reject(new Error('network failed'))
    await flushPromises()
    expect(wrapper.vm.files.find((file) => file.name === 'new.pdf')?.status).toBe('error')
    expect(wrapper.emitted('input')).toBeUndefined()

    const replacement = wrapper.vm.files.find((file) => file.name === 'new.pdf')
    wrapper.vm.retry(replacement?.uid || '')
    secondAttempt.resolve({ id: 'new', name: 'new.pdf', url: '/new.pdf' })
    await flushPromises()

    expect(latestInput(wrapper)?.map((item) => item.id)).toEqual(['new'])
    expect(wrapper.vm.files.map((file) => file.name)).toEqual(['new.pdf'])
  })

  it('supports manual upload and ignores a canceled request result', async () => {
    const job = deferred<UploadItem>()
    let requestSignal: AbortSignal | undefined
    const request = vi.fn(({ signal }: UploadRequestContext) => {
      requestSignal = signal
      return job.promise
    })
    const wrapper = mountUpload({ request, autoUpload: false })

    await selectFile(wrapper, createFile('manual.txt'))
    expect(request).not.toHaveBeenCalled()

    wrapper.vm.submit()
    await flushPromises()
    expect(request).toHaveBeenCalledTimes(1)

    const uid = wrapper.vm.files[0].uid
    wrapper.vm.abort(uid)
    expect(requestSignal?.aborted).toBe(true)
    expect(wrapper.vm.files[0].status).toBe('ready')

    job.resolve({ name: 'manual.txt', url: '/manual.txt' })
    await flushPromises()
    expect(wrapper.emitted('input')).toBeUndefined()
  })

  it('aborts all tasks without starting files that are still queued', async () => {
    const jobs: Array<Deferred<UploadItem>> = []
    const request = vi.fn(() => {
      const job = deferred<UploadItem>()
      jobs.push(job)
      return job.promise
    })
    const wrapper = mountUpload({ request, multiple: true, concurrency: 1 })

    await selectFile(wrapper, createFile('one.txt'))
    await selectFile(wrapper, createFile('two.txt'))
    await selectFile(wrapper, createFile('three.txt'))
    expect(request).toHaveBeenCalledTimes(1)

    wrapper.vm.abort()
    await flushPromises()

    expect(request).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.activeCount).toBe(0)
    expect(wrapper.vm.files.map((file) => file.status)).toEqual(['ready', 'ready', 'ready'])
  })

  it('validates type, size, count, and duplicate files before upload', async () => {
    const pending = deferred<UploadItem>()
    const request = vi.fn(() => pending.promise)
    const wrapper = mountUpload({
      request,
      multiple: true,
      accept: '.pdf,image/*',
      maxSizeMb: 0.001,
      limit: 1
    })

    await selectFile(wrapper, createFile('notes.txt'))
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'type' })

    await selectFile(wrapper, createFile('large.pdf', 2048, 'application/pdf'))
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'size' })

    const accepted = createFile('accepted.pdf', 128, 'application/pdf')
    await selectFile(wrapper, accepted)
    await selectFile(wrapper, createFile('another.pdf', 128, 'application/pdf'))
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'limit' })

    await wrapper.setProps({ limit: 2 })
    await selectFile(wrapper, accepted)
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'duplicate' })
  })

  it('keeps failed files visible without consuming a limit slot', async () => {
    const replacement = deferred<UploadItem>()
    const request = vi
      .fn<UploadRequest>()
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockReturnValueOnce(replacement.promise)
    const wrapper = mountUpload({ request, mode: 'image', multiple: true, limit: 1 })

    await selectFile(wrapper, createFile('failed.png', 128, 'image/png'))
    expect(wrapper.vm.files[0].status).toBe('error')
    expect(wrapper.vm.selectorHidden).toBe(false)

    await selectFile(wrapper, createFile('replacement.png', 128, 'image/png'))
    expect(request).toHaveBeenCalledTimes(2)
    expect(wrapper.vm.selectorHidden).toBe(true)

    wrapper.vm.retry(wrapper.vm.files[0].uid)
    expect(request).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({ code: 'limit' })
  })

  it('supports async validation and passes the configured request context', async () => {
    const beforeUpload = vi.fn(async (file: File) => file.name === 'allowed.txt')
    const request = vi.fn(async ({ file }: UploadRequestContext) => ({
      id: file.name,
      name: file.name,
      url: `/uploads/${file.name}`
    }))
    const wrapper = mountUpload({
      request,
      beforeUpload,
      fieldName: 'attachment',
      data: (file: File) => ({ category: 'contract', sourceName: file.name })
    })

    await selectFile(wrapper, createFile('blocked.txt'))
    expect(request).not.toHaveBeenCalled()
    expect(wrapper.emitted('validation-error')?.at(-1)?.[0]).toMatchObject({
      code: 'before-upload'
    })

    await selectFile(wrapper, createFile('allowed.txt'))
    expect(beforeUpload).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldName: 'attachment',
        data: { category: 'contract', sourceName: 'allowed.txt' }
      })
    )
    expect(latestInput(wrapper)?.[0]).toMatchObject({ name: 'allowed.txt' })

    wrapper.vm.clear()
    expect(latestInput(wrapper)).toEqual([])
    expect(wrapper.vm.files).toEqual([])
  })

  it('allows beforeRemove to block local deletion using an immutable public snapshot', async () => {
    const beforeRemove = vi.fn<UploadBeforeRemove>(async () => false)
    const wrapper = mountUpload({
      request: vi.fn(),
      beforeRemove,
      value: [{ uid: 'saved', id: 7, name: 'saved.pdf', url: '/saved.pdf' }]
    })

    await wrapper.vm.remove('saved')
    expect(wrapper.vm.files).toHaveLength(1)
    expect(wrapper.emitted('input')).toBeUndefined()
    expect(beforeRemove.mock.calls[0]?.[0]).toMatchObject({
      uid: 'saved',
      name: 'saved.pdf',
      status: 'success',
      percentage: 100
    })
    expect(beforeRemove.mock.calls[0]?.[0]).not.toHaveProperty('runId')

    await wrapper.setProps({ beforeRemove: async () => true })
    await wrapper.vm.remove('saved')
    expect(latestInput(wrapper)).toEqual([])
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('previews images, removes values locally, and revokes temporary URLs', async () => {
    const requestJob = deferred<UploadItem>()
    const wrapper = mountUpload({
      request: () => requestJob.promise,
      mode: 'image',
      multiple: true
    })
    const image = createFile('avatar.png', 128, 'image/png')

    await selectFile(wrapper, image)
    const pendingFile = wrapper.vm.files[0]
    wrapper.vm.openPreview(pendingFile)
    expect(wrapper.vm.previewVisible).toBe(true)
    expect(wrapper.emitted('preview')).toHaveLength(1)

    requestJob.resolve({ id: 'avatar', name: image.name, url: '/avatar.png' })
    await flushPromises()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x-upload-1')

    await wrapper.vm.remove(wrapper.vm.files[0].uid)
    expect(latestInput(wrapper)).toEqual([])
    expect(wrapper.emitted('remove')?.[0]?.[0]).toMatchObject({ id: 'avatar' })
  })

  it('exports and registers Upload with compatible component names', () => {
    const component = vi.fn()

    ;(Vue2ElementBusiness.install as any)({ component })

    expect(ExportedUpload).toBe(Upload)
    expect(XUpload).toBe(Upload)
    expect(component).toHaveBeenCalledWith('XUpload', Upload)
    expect(component).toHaveBeenCalledWith('Upload', Upload)
  })
})
