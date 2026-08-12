import Vue, { type CreateElement, type VNode } from 'vue'
import {
  clampPercentage,
  cloneUploadItem,
  formatFileSize,
  getErrorMessage,
  matchesFileAccept,
  normalizeUploadItem
} from '@amusite/business-core'
import type {
  UploadChangeDetail,
  UploadData,
  UploadFileState,
  UploadItem,
  UploadRequest,
  UploadValidationError,
  UploadValidationErrorCode
} from '../types'

const BYTES_PER_MEGABYTE = 1024 * 1024
let uploadUidSeed = 0

interface RuntimeUploadFile extends UploadFileState {
  ownsPreviewUrl: boolean
  runId: number
}

interface ActiveUploadTask {
  runId: number
  controller?: AbortController
}

interface ElementUploadFile {
  uid?: string | number
  raw?: File & { uid?: string | number }
}

function createUploadUid(): string {
  uploadUidSeed += 1
  return `x-upload-${Date.now()}-${uploadUidSeed}`
}

function getUploadItemIdentity(item: UploadItem): string {
  if (item.uid) {
    return `uid:${item.uid}`
  }

  if (item.id !== undefined && item.id !== null) {
    return `id:${item.id}`
  }

  if (item.url) {
    return `url:${item.url}`
  }

  return `file:${item.name}:${item.size ?? ''}`
}

function isSameRawFile(left: RuntimeUploadFile, right: File): boolean {
  if (left.name !== right.name || left.size !== right.size) {
    return false
  }

  if (!left.file) {
    return true
  }

  return left.file.lastModified === right.lastModified
}

function countsTowardsLimit(file: RuntimeUploadFile): boolean {
  return ['ready', 'queued', 'uploading', 'success'].includes(file.status)
}

function snapshotUploadFile(file: RuntimeUploadFile): UploadFileState {
  return {
    uid: file.uid,
    name: file.name,
    url: file.url,
    size: file.size,
    type: file.type,
    status: file.status,
    percentage: file.percentage,
    file: file.file,
    item: file.item ? cloneUploadItem(file.item) : undefined,
    error: file.error,
    errorMessage: file.errorMessage
  }
}

export default Vue.extend({
  name: 'Upload',
  inheritAttrs: false,
  props: {
    value: {
      type: Array,
      default: () => []
    },
    request: {
      type: Function,
      required: true
    },
    mode: {
      type: String,
      default: 'file',
      validator: (value: string) => ['file', 'image'].includes(value)
    },
    multiple: {
      type: Boolean,
      default: false
    },
    limit: {
      type: Number,
      default: 0
    },
    accept: {
      type: String,
      default: ''
    },
    maxSizeMb: {
      type: Number,
      default: 0
    },
    autoUpload: {
      type: Boolean,
      default: true
    },
    drag: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    concurrency: {
      type: Number,
      default: 3
    },
    fieldName: {
      type: String,
      default: 'file'
    },
    data: {
      type: [Object, Function],
      default: () => ({})
    },
    beforeUpload: {
      type: Function,
      default: undefined
    },
    beforeRemove: {
      type: Function,
      default: undefined
    },
    allowDuplicate: {
      type: Boolean,
      default: false
    },
    showFileList: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      files: [] as RuntimeUploadFile[],
      queue: [] as string[],
      activeTasks: {} as Record<string, ActiveUploadTask>,
      activeCount: 0,
      queueSuspended: false,
      selectionChain: Promise.resolve() as Promise<void>,
      validationMessage: '',
      previewVisible: false,
      previewUid: '',
      destroyed: false
    }
  },
  computed: {
    resolvedAccept(this: any): string {
      if (this.accept) {
        return this.accept
      }

      return this.mode === 'image' ? 'image/*' : ''
    },
    normalizedConcurrency(this: any): number {
      const value = Math.floor(Number(this.concurrency))
      return Number.isFinite(value) && value > 0 ? value : 1
    },
    limitFileCount(this: any): number {
      return this.files.filter((file: RuntimeUploadFile) => countsTowardsLimit(file)).length
    },
    selectorHidden(this: any): boolean {
      return (
        this.mode === 'image' &&
        this.multiple &&
        this.limit > 0 &&
        this.limitFileCount >= this.limit
      )
    }
  },
  watch: {
    value: {
      immediate: true,
      deep: true,
      handler(this: any, value: UploadItem[]) {
        this.syncFromValue(value)
      }
    },
    concurrency(this: any) {
      this.pumpQueue()
    }
  },
  beforeDestroy(this: any) {
    this.destroyed = true
    this.abortAll(true)
    this.files.forEach((file: RuntimeUploadFile) => this.releasePreviewUrl(file))
  },
  methods: {
    createRuntimeFromItem(this: any, item: UploadItem): RuntimeUploadFile {
      const normalizedItem = cloneUploadItem(item)
      const uid = normalizedItem.uid || createUploadUid()
      normalizedItem.uid = uid

      return {
        uid,
        name: normalizedItem.name,
        url: normalizedItem.url,
        size: normalizedItem.size,
        type: normalizedItem.type,
        status: 'success',
        percentage: 100,
        item: normalizedItem,
        ownsPreviewUrl: false,
        runId: 0
      }
    },
    syncFromValue(this: any, value: UploadItem[]) {
      const incoming = Array.isArray(value) ? value : []
      const currentSuccess = this.files.filter(
        (file: RuntimeUploadFile) => file.status === 'success'
      )
      const pending = this.files.filter((file: RuntimeUploadFile) => file.status !== 'success')
      const usedUids = new Set<string>()
      const nextSuccess = incoming.map((item) => {
        const identity = getUploadItemIdentity(item)
        const existing = currentSuccess.find((file: RuntimeUploadFile) => {
          if (usedUids.has(file.uid) || !file.item) {
            return false
          }

          return getUploadItemIdentity(file.item) === identity
        })

        if (!existing) {
          return this.createRuntimeFromItem(item)
        }

        usedUids.add(existing.uid)
        const normalizedItem = cloneUploadItem({ ...item, uid: item.uid || existing.uid })
        existing.item = normalizedItem
        existing.name = normalizedItem.name
        existing.url = normalizedItem.url
        existing.size = normalizedItem.size
        existing.type = normalizedItem.type
        return existing
      })

      currentSuccess.forEach((file: RuntimeUploadFile) => {
        if (!usedUids.has(file.uid) && !nextSuccess.includes(file)) {
          this.releasePreviewUrl(file)
        }
      })

      this.files = [...nextSuccess, ...pending]
    },
    getFile(this: any, uid: string): RuntimeUploadFile | undefined {
      return this.files.find((file: RuntimeUploadFile) => file.uid === uid)
    },
    getSuccessfulValue(this: any): UploadItem[] {
      return this.files
        .filter((file: RuntimeUploadFile) => file.status === 'success' && file.item)
        .map((file: RuntimeUploadFile) => cloneUploadItem(file.item as UploadItem))
    },
    emitValueChange(this: any, detail: UploadChangeDetail) {
      const value = this.getSuccessfulValue()
      const safeDetail: UploadChangeDetail = {
        ...detail,
        file: detail.file ? snapshotUploadFile(detail.file as RuntimeUploadFile) : undefined,
        item: detail.item ? cloneUploadItem(detail.item) : undefined
      }
      this.$emit('input', value)
      this.$emit('change', value, safeDetail)
    },
    reportValidation(
      this: any,
      code: UploadValidationErrorCode,
      message: string,
      file?: File,
      error?: unknown
    ) {
      const detail: UploadValidationError = { code, message, file, error }
      this.validationMessage = message
      this.$emit('validation-error', detail)
    },
    clearSelectorFiles(this: any) {
      this.$nextTick(() => {
        const selector = this.$refs.selector as any
        selector?.clearFiles?.()
      })
    },
    handleElementChange(this: any, elementFile: ElementUploadFile) {
      const rawFile = elementFile.raw

      if (!rawFile || this.disabled || this.destroyed) {
        return this.selectionChain
      }

      this.selectionChain = this.selectionChain.then(() => this.handleSelectedFile(rawFile))
      this.clearSelectorFiles()
      return this.selectionChain
    },
    async handleSelectedFile(this: any, rawFile: File) {
      if (this.destroyed) {
        return
      }

      if (!this.multiple) {
        this.discardTransientFiles()
      }

      if (this.multiple && this.limit > 0 && this.limitFileCount >= this.limit) {
        this.reportValidation('limit', `最多只能上传 ${this.limit} 个文件`, rawFile)
        return
      }

      if (!matchesFileAccept(rawFile, this.resolvedAccept)) {
        this.reportValidation('type', `文件 ${rawFile.name} 的类型不符合要求`, rawFile)
        return
      }

      if (this.maxSizeMb > 0 && rawFile.size > this.maxSizeMb * BYTES_PER_MEGABYTE) {
        this.reportValidation('size', `文件 ${rawFile.name} 不能超过 ${this.maxSizeMb} MB`, rawFile)
        return
      }

      if (
        !this.allowDuplicate &&
        this.files.some((file: RuntimeUploadFile) => isSameRawFile(file, rawFile))
      ) {
        this.reportValidation('duplicate', `文件 ${rawFile.name} 已存在`, rawFile)
        return
      }

      if (this.beforeUpload) {
        try {
          const accepted = await this.beforeUpload(rawFile, this.getSuccessfulValue())

          if (accepted === false) {
            this.reportValidation('before-upload', `文件 ${rawFile.name} 未通过上传校验`, rawFile)
            return
          }
        } catch (error) {
          this.reportValidation(
            'before-upload',
            getErrorMessage(error, `文件 ${rawFile.name} 未通过上传校验`),
            rawFile,
            error
          )
          return
        }
      }

      if (this.destroyed) {
        return
      }

      const uid = String((rawFile as File & { uid?: string | number }).uid || createUploadUid())
      const runtimeFile: RuntimeUploadFile = {
        uid,
        name: rawFile.name,
        size: rawFile.size,
        type: rawFile.type || undefined,
        status: 'ready',
        percentage: 0,
        file: rawFile,
        ownsPreviewUrl: false,
        runId: 0
      }

      if (this.mode === 'image' && typeof URL !== 'undefined' && URL.createObjectURL) {
        runtimeFile.url = URL.createObjectURL(rawFile)
        runtimeFile.ownsPreviewUrl = true
      }

      this.validationMessage = ''
      this.files.push(runtimeFile)
      this.$emit('change', this.getSuccessfulValue(), {
        type: 'select',
        file: snapshotUploadFile(runtimeFile)
      } as UploadChangeDetail)

      if (this.autoUpload) {
        this.enqueue(runtimeFile)
      }
    },
    discardTransientFiles(this: any) {
      const transientFiles = this.files.filter(
        (file: RuntimeUploadFile) => file.status !== 'success'
      )

      this.queueSuspended = true
      transientFiles.forEach((file: RuntimeUploadFile) => {
        this.abortFile(file, false)
        this.releasePreviewUrl(file)
      })
      this.queueSuspended = false

      if (transientFiles.length > 0) {
        const transientUids = new Set(transientFiles.map((file: RuntimeUploadFile) => file.uid))
        this.files = this.files.filter((file: RuntimeUploadFile) => !transientUids.has(file.uid))
      }
    },
    enqueue(this: any, file: RuntimeUploadFile) {
      if (!file.file || ['queued', 'uploading', 'success'].includes(file.status)) {
        return
      }

      if (typeof this.request !== 'function') {
        const error = new Error('Upload 组件缺少 request 回调')
        file.status = 'error'
        file.error = error
        file.errorMessage = error.message
        this.reportValidation('config', error.message, file.file, error)
        return
      }

      file.status = 'queued'
      file.error = undefined
      file.errorMessage = undefined
      file.percentage = 0

      if (!this.queue.includes(file.uid)) {
        this.queue.push(file.uid)
      }

      this.pumpQueue()
    },
    pumpQueue(this: any) {
      if (this.destroyed || this.queueSuspended) {
        return
      }

      while (this.activeCount < this.normalizedConcurrency && this.queue.length > 0) {
        const uid = this.queue.shift() as string
        const file = this.getFile(uid)

        if (!file || file.status !== 'queued' || !file.file) {
          continue
        }

        this.startUpload(file)
      }
    },
    resolveRequestData(this: any, file: File): Record<string, unknown> {
      const data = this.data as UploadData
      const resolved = typeof data === 'function' ? data(file) : data
      return resolved && typeof resolved === 'object' ? { ...resolved } : {}
    },
    startUpload(this: any, file: RuntimeUploadFile) {
      const rawFile = file.file as File
      const runId = file.runId + 1
      const controller = typeof AbortController === 'undefined' ? undefined : new AbortController()
      const request = this.request as UploadRequest

      file.runId = runId
      file.status = 'uploading'
      file.percentage = 0
      this.activeTasks[file.uid] = { runId, controller }
      this.activeCount += 1

      Promise.resolve()
        .then(() =>
          request({
            file: rawFile,
            fieldName: this.fieldName,
            data: this.resolveRequestData(rawFile),
            signal: controller?.signal,
            onProgress: (percentage) => this.handleProgress(file.uid, runId, percentage)
          })
        )
        .then((result) => this.handleSuccess(file.uid, runId, result))
        .catch((error) => this.handleFailure(file.uid, runId, error))
    },
    isCurrentRun(this: any, uid: string, runId: number): boolean {
      return this.activeTasks[uid]?.runId === runId
    },
    handleProgress(this: any, uid: string, runId: number, percentage: number) {
      if (!this.isCurrentRun(uid, runId)) {
        return
      }

      const file = this.getFile(uid)

      if (!file) {
        return
      }

      file.percentage = clampPercentage(percentage)
      this.$emit('progress', snapshotUploadFile(file))
    },
    handleSuccess(this: any, uid: string, runId: number, result: unknown) {
      if (!this.isCurrentRun(uid, runId)) {
        return
      }

      const file = this.getFile(uid)

      if (!file || !file.file) {
        this.completeTask(uid, runId)
        return
      }

      let item: UploadItem

      try {
        item = normalizeUploadItem(result, file.file, uid)
      } catch (error) {
        this.handleFailure(uid, runId, error)
        return
      }

      if (!this.multiple) {
        const removedFiles = this.files.filter(
          (current: RuntimeUploadFile) => current.uid !== uid && current.status === 'success'
        )
        removedFiles.forEach((current: RuntimeUploadFile) => this.releasePreviewUrl(current))
        this.files = this.files.filter(
          (current: RuntimeUploadFile) => current.uid === uid || current.status !== 'success'
        )
      }

      this.releasePreviewUrl(file)
      file.item = item
      file.name = item.name
      file.url = item.url
      file.size = item.size
      file.type = item.type
      file.status = 'success'
      file.percentage = 100
      file.error = undefined
      file.errorMessage = undefined

      this.completeTask(uid, runId)
      this.emitValueChange({ type: 'success', file, item })
      this.$emit('success', cloneUploadItem(item), snapshotUploadFile(file))
    },
    handleFailure(this: any, uid: string, runId: number, error: unknown) {
      if (!this.isCurrentRun(uid, runId)) {
        return
      }

      const file = this.getFile(uid)

      if (!file) {
        this.completeTask(uid, runId)
        return
      }

      file.status = 'error'
      file.error = error
      file.errorMessage = getErrorMessage(error, '上传失败，请重试')
      this.completeTask(uid, runId)
      this.$emit('error', error, snapshotUploadFile(file))
    },
    completeTask(this: any, uid: string, runId: number) {
      if (!this.isCurrentRun(uid, runId)) {
        return
      }

      delete this.activeTasks[uid]
      this.activeCount = Math.max(0, this.activeCount - 1)
      this.pumpQueue()
    },
    abortFile(this: any, file: RuntimeUploadFile, emitEvent = true) {
      const queueIndex = this.queue.indexOf(file.uid)

      if (queueIndex >= 0) {
        this.queue.splice(queueIndex, 1)
      }

      const task = this.activeTasks[file.uid]

      if (task) {
        delete this.activeTasks[file.uid]
        this.activeCount = Math.max(0, this.activeCount - 1)
        file.runId += 1
        task.controller?.abort()
      }

      if (file.status === 'queued' || file.status === 'uploading') {
        file.status = 'ready'
        file.percentage = 0
        file.error = undefined
        file.errorMessage = undefined

        if (emitEvent) {
          this.$emit('cancel', snapshotUploadFile(file))
        }
      }

      this.pumpQueue()
    },
    abort(this: any, uid?: string) {
      if (uid) {
        const file = this.getFile(uid)

        if (file) {
          this.abortFile(file)
        }
        return
      }

      this.abortAll(false)
    },
    abortAll(this: any, silent: boolean) {
      this.queueSuspended = true
      this.files.forEach((file: RuntimeUploadFile) => {
        if (file.status === 'queued' || file.status === 'uploading') {
          this.abortFile(file, !silent)
        }
      })
      this.queue = []
      this.queueSuspended = false
    },
    submit(this: any) {
      this.files
        .filter((file: RuntimeUploadFile) => file.status === 'ready')
        .forEach((file: RuntimeUploadFile) => this.enqueue(file))
    },
    retry(this: any, uid: string) {
      const file = this.getFile(uid)

      if (!file || file.status !== 'error') {
        return
      }

      if (this.multiple && this.limit > 0 && this.limitFileCount >= this.limit) {
        this.reportValidation('limit', `最多只能上传 ${this.limit} 个文件`, file.file)
        return
      }

      this.enqueue(file)
    },
    async remove(this: any, uid: string) {
      const file = this.getFile(uid)

      if (!file) {
        return
      }

      if (this.beforeRemove) {
        try {
          const accepted = await this.beforeRemove(
            snapshotUploadFile(file),
            this.getSuccessfulValue()
          )

          if (accepted === false) {
            return
          }
        } catch (error) {
          this.$emit('error', error, snapshotUploadFile(file))
          return
        }
      }

      if (file.status === 'queued' || file.status === 'uploading') {
        this.abortFile(file)
      }

      const wasSuccessful = file.status === 'success'
      const item = file.item
      this.releasePreviewUrl(file)
      this.files = this.files.filter((current: RuntimeUploadFile) => current.uid !== uid)

      if (this.previewUid === uid) {
        this.closePreview()
      }

      if (wasSuccessful) {
        this.emitValueChange({ type: 'remove', file, item })
      } else {
        this.$emit('change', this.getSuccessfulValue(), {
          type: 'remove',
          file: snapshotUploadFile(file),
          item
        } as UploadChangeDetail)
      }

      this.$emit('remove', item ? cloneUploadItem(item) : undefined, snapshotUploadFile(file))
    },
    clear(this: any) {
      this.abortAll(false)
      this.files.forEach((file: RuntimeUploadFile) => this.releasePreviewUrl(file))
      this.files = []
      this.validationMessage = ''
      this.closePreview()
      this.emitValueChange({ type: 'clear' })
    },
    releasePreviewUrl(file: RuntimeUploadFile) {
      if (file.ownsPreviewUrl && file.url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(file.url)
      }

      file.ownsPreviewUrl = false
    },
    openPreview(this: any, file: RuntimeUploadFile) {
      this.$emit(
        'preview',
        file.item ? cloneUploadItem(file.item) : undefined,
        snapshotUploadFile(file)
      )

      if (this.mode !== 'image' || !file.url) {
        return
      }

      this.previewUid = file.uid
      this.previewVisible = true
    },
    closePreview(this: any) {
      this.previewVisible = false
      this.previewUid = ''
    },
    renderActionButton(
      this: any,
      h: CreateElement,
      icon: string,
      label: string,
      handler: (event: Event) => void
    ): VNode {
      return h(
        'el-button',
        {
          class: 'x-upload__action',
          props: {
            type: 'text',
            disabled: this.disabled
          },
          attrs: {
            title: label,
            'aria-label': label
          },
          on: {
            click: (event: Event) => {
              event.stopPropagation()
              handler(event)
            }
          }
        },
        [h('i', { class: icon, attrs: { 'aria-hidden': 'true' } })]
      )
    },
    renderFileActions(this: any, h: CreateElement, file: RuntimeUploadFile): VNode[] {
      const actions: VNode[] = []

      if (file.url) {
        actions.push(
          this.renderActionButton(h, 'el-icon-zoom-in', '预览', () => this.openPreview(file))
        )
      }

      if (file.status === 'error') {
        actions.push(
          this.renderActionButton(h, 'el-icon-refresh-right', '重试', () => this.retry(file.uid))
        )
      }

      if (file.status === 'queued' || file.status === 'uploading') {
        actions.push(
          this.renderActionButton(h, 'el-icon-video-pause', '取消上传', () => this.abort(file.uid))
        )
      }

      actions.push(
        this.renderActionButton(h, 'el-icon-delete', '删除', () => this.remove(file.uid))
      )
      return actions
    },
    renderError(this: any, h: CreateElement, file?: RuntimeUploadFile): VNode | VNode[] | null {
      const message = file?.errorMessage || this.validationMessage

      if (!message) {
        return null
      }

      const errorSlot = this.$scopedSlots.error?.({
        type: file ? 'upload' : 'validation',
        message,
        file
      })

      if (errorSlot) {
        return errorSlot
      }

      return h(
        'div',
        {
          class: file ? 'x-upload__file-error' : 'x-upload__validation-error',
          attrs: file ? {} : { role: 'alert' }
        },
        [message]
      )
    },
    renderFileItem(this: any, h: CreateElement, file: RuntimeUploadFile): VNode {
      const scopedFile = this.$scopedSlots.file?.({
        file,
        retry: () => this.retry(file.uid),
        abort: () => this.abort(file.uid),
        remove: () => this.remove(file.uid),
        preview: () => this.openPreview(file)
      })

      if (scopedFile) {
        return h('li', { key: file.uid, class: 'x-upload__custom-file' }, scopedFile)
      }

      const statusText: Record<string, string> = {
        ready: '等待上传',
        queued: '排队中',
        uploading: `上传中 ${file.percentage}%`,
        success: '已上传',
        error: '上传失败'
      }
      const meta = [formatFileSize(file.size), statusText[file.status]].filter(Boolean).join(' · ')

      return h(
        'li',
        {
          key: file.uid,
          class: ['x-upload__file', `is-${file.status}`]
        },
        [
          h('i', {
            class: 'el-icon-document x-upload__file-icon',
            attrs: { 'aria-hidden': 'true' }
          }),
          h('div', { class: 'x-upload__file-main' }, [
            h('div', { class: 'x-upload__file-name', attrs: { title: file.name } }, [file.name]),
            h('div', { class: 'x-upload__file-meta' }, [meta]),
            file.status === 'uploading'
              ? h('el-progress', {
                  props: {
                    percentage: file.percentage,
                    strokeWidth: 4,
                    showText: false
                  }
                })
              : null,
            this.renderError(h, file)
          ]),
          h('div', { class: 'x-upload__file-actions' }, this.renderFileActions(h, file))
        ]
      )
    },
    renderImageItem(this: any, h: CreateElement, file: RuntimeUploadFile): VNode {
      const scopedFile = this.$scopedSlots.file?.({
        file,
        retry: () => this.retry(file.uid),
        abort: () => this.abort(file.uid),
        remove: () => this.remove(file.uid),
        preview: () => this.openPreview(file)
      })

      if (scopedFile) {
        return h('li', { key: file.uid, class: 'x-upload__custom-file' }, scopedFile)
      }

      return h(
        'li',
        {
          key: file.uid,
          class: ['x-upload__image', `is-${file.status}`]
        },
        [
          file.url
            ? h('img', {
                class: 'x-upload__image-thumbnail',
                attrs: { src: file.url, alt: file.name }
              })
            : h('i', {
                class: 'el-icon-picture-outline x-upload__image-placeholder',
                attrs: { 'aria-hidden': 'true' }
              }),
          file.status === 'uploading' || file.status === 'queued'
            ? h('div', { class: 'x-upload__image-progress' }, [
                h('el-progress', {
                  props: {
                    type: 'circle',
                    percentage: file.percentage,
                    width: 56,
                    strokeWidth: 4
                  }
                })
              ])
            : null,
          h('div', { class: 'x-upload__image-actions' }, this.renderFileActions(h, file)),
          file.status === 'error'
            ? h('div', { class: 'x-upload__image-error' }, [
                h('i', { class: 'el-icon-warning-outline', attrs: { 'aria-hidden': 'true' } }),
                h('span', [file.errorMessage || '上传失败'])
              ])
            : null
        ]
      )
    },
    renderList(this: any, h: CreateElement): VNode | null {
      if (!this.showFileList || this.files.length === 0) {
        return null
      }

      return h(
        'ul',
        {
          class: [
            'x-upload__list',
            this.mode === 'image' ? 'x-upload__list--image' : 'x-upload__list--file'
          ]
        },
        this.files.map((file: RuntimeUploadFile) =>
          this.mode === 'image' ? this.renderImageItem(h, file) : this.renderFileItem(h, file)
        )
      )
    },
    renderDefaultTrigger(this: any, h: CreateElement): VNode {
      if (this.drag) {
        return h('div', { class: 'x-upload__drag-content' }, [
          h('i', {
            class: 'el-icon-upload x-upload__drag-icon',
            attrs: { 'aria-hidden': 'true' }
          }),
          h('div', { class: 'x-upload__drag-text' }, [
            '将文件拖到此处，或',
            h('span', ['点击选择'])
          ])
        ])
      }

      if (this.mode === 'image') {
        return h(
          'div',
          {
            class: 'x-upload__image-trigger',
            attrs: {
              title: '选择图片',
              'aria-label': '选择图片'
            }
          },
          [h('i', { class: 'el-icon-plus', attrs: { 'aria-hidden': 'true' } })]
        )
      }

      return h(
        'el-button',
        {
          props: {
            type: 'primary',
            size: 'small',
            icon: 'el-icon-upload2',
            disabled: this.disabled
          }
        },
        ['选择文件']
      )
    },
    renderSelector(this: any, h: CreateElement): VNode {
      const trigger = this.$scopedSlots.trigger?.({ disabled: this.disabled, files: this.files }) ||
        this.$slots.trigger || [this.renderDefaultTrigger(h)]

      return h(
        'el-upload',
        {
          ref: 'selector',
          class: ['x-upload__selector', { 'is-drag': this.drag }],
          props: {
            action: '',
            autoUpload: false,
            showFileList: false,
            multiple: this.multiple,
            drag: this.drag,
            accept: this.resolvedAccept,
            disabled: this.disabled,
            listType: this.mode === 'image' && !this.drag ? 'picture-card' : 'text',
            onChange: this.handleElementChange
          }
        },
        trigger
      )
    },
    renderPreview(this: any, h: CreateElement): VNode | null {
      const file = this.getFile(this.previewUid)

      if (!file || !file.url) {
        return null
      }

      const previewSlot = this.$scopedSlots.preview?.({
        file,
        item: file.item,
        close: this.closePreview
      })
      const content = previewSlot || [
        h('img', {
          class: 'x-upload__preview-image',
          attrs: { src: file.url, alt: file.name }
        })
      ]

      return h(
        'el-dialog',
        {
          props: {
            visible: this.previewVisible,
            appendToBody: true,
            customClass: 'x-upload__preview-dialog',
            title: file.name
          },
          on: {
            'update:visible': (visible: boolean) => {
              if (!visible) {
                this.closePreview()
              }
            },
            close: this.closePreview
          }
        },
        content
      )
    }
  },
  render(this: any, h: CreateElement): VNode {
    const tip = this.$slots.tip
    const selector = this.selectorHidden ? null : this.renderSelector(h)
    const list = this.renderList(h)
    const controls = this.mode === 'image' && !this.drag ? [list, selector] : [selector, list]

    return h(
      'div',
      {
        class: ['x-upload', `x-upload--${this.mode}`, { 'is-disabled': this.disabled }],
        attrs: {
          ...this.$attrs,
          'aria-busy': String(this.activeCount > 0)
        }
      },
      [
        h(
          'div',
          {
            class: [
              'x-upload__controls',
              this.mode === 'image' ? 'x-upload__controls--image' : 'x-upload__controls--file'
            ]
          },
          controls
        ),
        tip ? h('div', { class: 'x-upload__tip' }, tip) : null,
        this.renderError(h),
        this.renderPreview(h)
      ]
    )
  }
})
