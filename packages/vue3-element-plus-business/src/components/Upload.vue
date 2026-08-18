<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  Delete,
  Document,
  Picture,
  Plus,
  RefreshRight,
  VideoPause,
  View,
  WarningFilled,
  UploadFilled
} from '@element-plus/icons-vue'
import {
  clampPercentage,
  cloneUploadItem,
  formatFileSize,
  getErrorMessage,
  matchesFileAccept,
  normalizeUploadItem
} from '@amusite/business-core'
import type {
  UploadBeforeRemove,
  UploadBeforeUpload,
  UploadChangeDetail,
  UploadData,
  UploadFileState,
  UploadItem,
  UploadMode,
  UploadRequest,
  UploadValidationError,
  UploadValidationErrorCode
} from '@amusite/business-core'
import { useBusinessContext } from '../context'

const MB = 1024 * 1024
let uidSeed = 0
const createUid = () => `x-upload-${Date.now()}-${++uidSeed}`
interface RuntimeUploadFile extends UploadFileState {
  ownsPreviewUrl: boolean
  runId: number
}
interface ActiveTask {
  runId: number
  controller?: AbortController
}
const props = withDefaults(
  defineProps<{
    modelValue?: UploadItem[]
    request: UploadRequest
    mode?: UploadMode
    multiple?: boolean
    limit?: number
    accept?: string
    maxSizeMb?: number
    autoUpload?: boolean
    drag?: boolean
    disabled?: boolean
    concurrency?: number
    fieldName?: string
    data?: UploadData
    beforeUpload?: UploadBeforeUpload
    beforeRemove?: UploadBeforeRemove
    allowDuplicate?: boolean
    showFileList?: boolean
  }>(),
  {
    modelValue: () => [],
    mode: 'file',
    multiple: false,
    limit: 0,
    accept: '',
    maxSizeMb: 0,
    autoUpload: true,
    drag: false,
    disabled: false,
    concurrency: 3,
    fieldName: 'file',
    data: () => ({}),
    allowDuplicate: false,
    showFileList: true
  }
)
const emit = defineEmits<{
  'update:modelValue': [value: UploadItem[]]
  change: [value: UploadItem[], detail: UploadChangeDetail]
  progress: [file: UploadFileState]
  success: [item: UploadItem, file: UploadFileState]
  error: [error: unknown, file: UploadFileState]
  'validation-error': [detail: UploadValidationError]
  remove: [item: UploadItem | undefined, file: UploadFileState]
  preview: [item: UploadItem | undefined, file: UploadFileState]
  cancel: [file: UploadFileState]
}>()
defineSlots<{
  trigger?: (scope: { disabled: boolean; files: UploadFileState[] }) => unknown
  tip?: () => unknown
  file?: (scope: {
    file: UploadFileState
    retry: () => void
    abort: () => void
    remove: () => Promise<void>
    preview: () => void
  }) => unknown
  error?: (scope: {
    type: 'upload' | 'validation'
    message: string
    file?: UploadFileState
  }) => unknown
  preview?: (scope: { file: UploadFileState; item?: UploadItem; close: () => void }) => unknown
}>()
const selectorRef = ref<{ clearFiles?: () => void }>()
const business = useBusinessContext()
const files = ref<RuntimeUploadFile[]>([])
const queue = ref<string[]>([])
const activeTasks: Record<string, ActiveTask> = {}
const activeCount = ref(0)
const validationMessage = ref('')
const previewVisible = ref(false)
const previewUid = ref('')
let queueSuspended = false
let selectionChain = Promise.resolve()
let destroyed = false
const resolvedAccept = computed(() => props.accept || (props.mode === 'image' ? 'image/*' : ''))
const normalizedConcurrency = computed(() => {
  const value = Math.floor(Number(props.concurrency))
  return Number.isFinite(value) && value > 0 ? value : 1
})
const limitFileCount = computed(
  () =>
    files.value.filter((file) => ['ready', 'queued', 'uploading', 'success'].includes(file.status))
      .length
)
const selectorHidden = computed(
  () =>
    props.mode === 'image' &&
    props.multiple &&
    props.limit > 0 &&
    limitFileCount.value >= props.limit
)
const previewFile = computed(() => files.value.find((file) => file.uid === previewUid.value))
function statusText(file: RuntimeUploadFile) {
  if (file.status === 'uploading')
    return business.t('upload.uploading', { percent: file.percentage })
  if (file.status === 'success') return business.t('upload.success')
  if (file.status === 'error') return business.t('upload.failed')
  if (file.status === 'queued') return business.t('upload.queued')
  return business.t('upload.ready')
}

function identity(item: UploadItem) {
  if (item.uid) return `uid:${item.uid}`
  if (item.id !== undefined && item.id !== null) return `id:${item.id}`
  if (item.url) return `url:${item.url}`
  return `file:${item.name}:${item.size ?? ''}`
}
function sameRawFile(left: RuntimeUploadFile, right: File) {
  return (
    left.name === right.name &&
    left.size === right.size &&
    (!left.file || left.file.lastModified === right.lastModified)
  )
}
function snapshot(file: RuntimeUploadFile): UploadFileState {
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
function createFromItem(item: UploadItem): RuntimeUploadFile {
  const normalized = cloneUploadItem(item)
  const uid = normalized.uid || createUid()
  normalized.uid = uid
  return {
    uid,
    name: normalized.name,
    url: normalized.url,
    size: normalized.size,
    type: normalized.type,
    status: 'success',
    percentage: 100,
    item: normalized,
    ownsPreviewUrl: false,
    runId: 0
  }
}
function releasePreviewUrl(file: RuntimeUploadFile) {
  if (file.ownsPreviewUrl && file.url && typeof URL !== 'undefined' && URL.revokeObjectURL)
    URL.revokeObjectURL(file.url)
  file.ownsPreviewUrl = false
}
function syncFromValue(value: UploadItem[]) {
  const incoming = Array.isArray(value) ? value : []
  const successes = files.value.filter((file) => file.status === 'success')
  const pending = files.value.filter((file) => file.status !== 'success')
  const used = new Set<string>()
  const next = incoming.map((item) => {
    const existing = successes.find(
      (file) => !used.has(file.uid) && file.item && identity(file.item) === identity(item)
    )
    if (!existing) return createFromItem(item)
    used.add(existing.uid)
    const normalized = cloneUploadItem({ ...item, uid: item.uid || existing.uid })
    Object.assign(existing, {
      item: normalized,
      name: normalized.name,
      url: normalized.url,
      size: normalized.size,
      type: normalized.type
    })
    return existing
  })
  successes.forEach((file) => {
    if (!used.has(file.uid) && !next.includes(file)) releasePreviewUrl(file)
  })
  files.value = [...next, ...pending]
}
watch(() => props.modelValue, syncFromValue, { immediate: true, deep: true })
watch(normalizedConcurrency, pumpQueue)
const getFile = (uid: string) => files.value.find((file) => file.uid === uid)
const successfulValue = () =>
  files.value
    .filter((file) => file.status === 'success' && file.item)
    .map((file) => cloneUploadItem(file.item!))
function emitValueChange(detail: UploadChangeDetail) {
  const value = successfulValue()
  const safeDetail = {
    ...detail,
    file: detail.file ? snapshot(detail.file as RuntimeUploadFile) : undefined,
    item: detail.item ? cloneUploadItem(detail.item) : undefined
  }
  emit('update:modelValue', value)
  emit('change', value, safeDetail)
}
function reportValidation(
  code: UploadValidationErrorCode,
  message: string,
  file?: File,
  error?: unknown
) {
  const detail = { code, message, file, error }
  validationMessage.value = message
  emit('validation-error', detail)
}
function clearSelectorFiles() {
  void nextTick(() => selectorRef.value?.clearFiles?.())
}
function handleElementChange(elementFile: { raw?: File }) {
  const raw = elementFile.raw
  if (!raw || props.disabled || destroyed) return selectionChain
  selectionChain = selectionChain.then(() => handleSelectedFile(raw))
  clearSelectorFiles()
  return selectionChain
}
async function handleSelectedFile(raw: File) {
  if (destroyed) return
  if (!props.multiple) discardTransientFiles()
  if (props.multiple && props.limit > 0 && limitFileCount.value >= props.limit)
    return reportValidation('limit', business.t('upload.limit', { limit: props.limit }), raw)
  if (!matchesFileAccept(raw, resolvedAccept.value))
    return reportValidation('type', business.t('upload.type', { name: raw.name }), raw)
  if (props.maxSizeMb > 0 && raw.size > props.maxSizeMb * MB)
    return reportValidation(
      'size',
      business.t('upload.size', { name: raw.name, size: props.maxSizeMb }),
      raw
    )
  if (!props.allowDuplicate && files.value.some((file) => sameRawFile(file, raw)))
    return reportValidation('duplicate', business.t('upload.duplicate', { name: raw.name }), raw)
  if (props.beforeUpload) {
    try {
      if ((await props.beforeUpload(raw, successfulValue())) === false)
        return reportValidation(
          'before-upload',
          business.t('upload.beforeRejected', { name: raw.name }),
          raw
        )
    } catch (error) {
      return reportValidation(
        'before-upload',
        getErrorMessage(error, business.t('upload.beforeRejected', { name: raw.name })),
        raw,
        error
      )
    }
  }
  if (destroyed) return
  const uid = String((raw as File & { uid?: string | number }).uid || createUid())
  const runtime: RuntimeUploadFile = {
    uid,
    name: raw.name,
    size: raw.size,
    type: raw.type || undefined,
    status: 'ready',
    percentage: 0,
    file: raw,
    ownsPreviewUrl: false,
    runId: 0
  }
  if (props.mode === 'image' && typeof URL !== 'undefined' && URL.createObjectURL) {
    runtime.url = URL.createObjectURL(raw)
    runtime.ownsPreviewUrl = true
  }
  validationMessage.value = ''
  files.value.push(runtime)
  emit('change', successfulValue(), { type: 'select', file: snapshot(runtime) })
  if (props.autoUpload) enqueue(runtime)
}
function discardTransientFiles() {
  const transient = files.value.filter((file) => file.status !== 'success')
  queueSuspended = true
  transient.forEach((file) => {
    abortFile(file, false)
    releasePreviewUrl(file)
  })
  queueSuspended = false
  const uids = new Set(transient.map((file) => file.uid))
  files.value = files.value.filter((file) => !uids.has(file.uid))
}
function enqueue(file: RuntimeUploadFile) {
  if (!file.file || ['queued', 'uploading', 'success'].includes(file.status)) return
  if (typeof props.request !== 'function') {
    const error = new Error(business.t('upload.missingRequest'))
    Object.assign(file, { status: 'error', error, errorMessage: error.message })
    reportValidation('config', error.message, file.file, error)
    return
  }
  Object.assign(file, {
    status: 'queued',
    error: undefined,
    errorMessage: undefined,
    percentage: 0
  })
  if (!queue.value.includes(file.uid)) queue.value.push(file.uid)
  pumpQueue()
}
function pumpQueue() {
  if (destroyed || queueSuspended) return
  while (activeCount.value < normalizedConcurrency.value && queue.value.length) {
    const file = getFile(queue.value.shift()!)
    if (file?.status === 'queued' && file.file) startUpload(file)
  }
}
function requestData(file: File) {
  const value = typeof props.data === 'function' ? props.data(file) : props.data
  return value && typeof value === 'object' ? { ...value } : {}
}
function startUpload(file: RuntimeUploadFile) {
  const raw = file.file!
  const currentRun = file.runId + 1
  const controller = typeof AbortController === 'undefined' ? undefined : new AbortController()
  file.runId = currentRun
  file.status = 'uploading'
  file.percentage = 0
  activeTasks[file.uid] = { runId: currentRun, controller }
  activeCount.value += 1
  business.telemetry?.({
    name: 'upload',
    phase: 'start',
    metadata: { name: file.name, size: file.size }
  })
  Promise.resolve()
    .then(() =>
      props.request({
        file: raw,
        fieldName: props.fieldName,
        data: requestData(raw),
        signal: controller?.signal,
        onProgress: (value) => handleProgress(file.uid, currentRun, value)
      })
    )
    .then((result) => handleSuccess(file.uid, currentRun, result))
    .catch((error) => handleFailure(file.uid, currentRun, error))
}
const currentRun = (uid: string, run: number) => activeTasks[uid]?.runId === run
function handleProgress(uid: string, run: number, value: number) {
  if (!currentRun(uid, run)) return
  const file = getFile(uid)
  if (file) {
    file.percentage = clampPercentage(value)
    emit('progress', snapshot(file))
  }
}
function handleSuccess(uid: string, run: number, result: UploadItem) {
  if (!currentRun(uid, run)) return
  const file = getFile(uid)
  if (!file?.file) return completeTask(uid, run)
  let item: UploadItem
  try {
    item = normalizeUploadItem(result, file.file, uid)
  } catch (error) {
    handleFailure(uid, run, error)
    return
  }
  if (!props.multiple) {
    const removed = files.value.filter((item) => item.uid !== uid && item.status === 'success')
    removed.forEach(releasePreviewUrl)
    files.value = files.value.filter((item) => item.uid === uid || item.status !== 'success')
  }
  releasePreviewUrl(file)
  Object.assign(file, {
    item,
    name: item.name,
    url: item.url,
    size: item.size,
    type: item.type,
    status: 'success',
    percentage: 100,
    error: undefined,
    errorMessage: undefined
  })
  completeTask(uid, run)
  emitValueChange({ type: 'success', file, item })
  emit('success', cloneUploadItem(item), snapshot(file))
  business.telemetry?.({
    name: 'upload',
    phase: 'success',
    metadata: { name: file.name, size: file.size }
  })
}
function handleFailure(uid: string, run: number, error: unknown) {
  if (!currentRun(uid, run)) return
  const file = getFile(uid)
  if (!file) return completeTask(uid, run)
  Object.assign(file, {
    status: 'error',
    error,
    errorMessage: getErrorMessage(error, business.t('common.operationFailed'))
  })
  completeTask(uid, run)
  business.notifyError?.(error, {
    source: 'Upload',
    action: 'upload',
    metadata: { name: file.name }
  })
  business.telemetry?.({ name: 'upload', phase: 'error', error, metadata: { name: file.name } })
  emit('error', error, snapshot(file))
}
function completeTask(uid: string, run: number) {
  if (!currentRun(uid, run)) return
  delete activeTasks[uid]
  activeCount.value = Math.max(0, activeCount.value - 1)
  pumpQueue()
}
function abortFile(file: RuntimeUploadFile, emitEvent = true) {
  const index = queue.value.indexOf(file.uid)
  if (index >= 0) queue.value.splice(index, 1)
  const task = activeTasks[file.uid]
  if (task) {
    delete activeTasks[file.uid]
    activeCount.value = Math.max(0, activeCount.value - 1)
    file.runId += 1
    task.controller?.abort()
  }
  if (file.status === 'queued' || file.status === 'uploading') {
    Object.assign(file, {
      status: 'ready',
      percentage: 0,
      error: undefined,
      errorMessage: undefined
    })
    if (emitEvent) emit('cancel', snapshot(file))
  }
  pumpQueue()
}
function abort(uid?: string) {
  if (uid) {
    const file = getFile(uid)
    if (file) abortFile(file)
  } else abortAll(false)
}
function abortAll(silent: boolean) {
  queueSuspended = true
  files.value.forEach((file) => {
    if (file.status === 'queued' || file.status === 'uploading') abortFile(file, !silent)
  })
  queue.value = []
  queueSuspended = false
}
function submit() {
  files.value.filter((file) => file.status === 'ready').forEach(enqueue)
}
function retry(uid: string) {
  const file = getFile(uid)
  if (!file || file.status !== 'error') return
  if (props.multiple && props.limit > 0 && limitFileCount.value >= props.limit)
    return reportValidation('limit', business.t('upload.limit', { limit: props.limit }), file.file)
  enqueue(file)
}
async function remove(uid: string) {
  const file = getFile(uid)
  if (!file) return
  if (props.beforeRemove) {
    try {
      if ((await props.beforeRemove(snapshot(file), successfulValue())) === false) return
    } catch (error) {
      emit('error', error, snapshot(file))
      return
    }
  }
  if (file.status === 'queued' || file.status === 'uploading') abortFile(file)
  const successful = file.status === 'success'
  const item = file.item
  releasePreviewUrl(file)
  files.value = files.value.filter((current) => current.uid !== uid)
  if (previewUid.value === uid) closePreview()
  if (successful) emitValueChange({ type: 'remove', file, item })
  else emit('change', successfulValue(), { type: 'remove', file: snapshot(file), item })
  emit('remove', item ? cloneUploadItem(item) : undefined, snapshot(file))
}
function clear() {
  abortAll(false)
  files.value.forEach(releasePreviewUrl)
  files.value = []
  validationMessage.value = ''
  closePreview()
  emitValueChange({ type: 'clear' })
}
function openPreview(file: RuntimeUploadFile) {
  emit('preview', file.item ? cloneUploadItem(file.item) : undefined, snapshot(file))
  if (props.mode === 'image' && file.url) {
    previewUid.value = file.uid
    previewVisible.value = true
  }
}
function closePreview() {
  previewVisible.value = false
  previewUid.value = ''
}
function fileScope(file: RuntimeUploadFile) {
  return {
    file: snapshot(file),
    retry: () => retry(file.uid),
    abort: () => abort(file.uid),
    remove: () => remove(file.uid),
    preview: () => openPreview(file)
  }
}
const noopUploadRequest = () => Promise.resolve()
onBeforeUnmount(() => {
  destroyed = true
  abortAll(true)
  files.value.forEach(releasePreviewUrl)
})
const publicFiles = computed<UploadFileState[]>(() => files.value.map(snapshot))
function previewPublicFile(file: UploadFileState) {
  const runtime = getFile(file.uid)
  if (runtime) openPreview(runtime)
}
defineExpose({
  files: publicFiles,
  activeCount,
  selectorHidden,
  submit,
  retry,
  abort,
  clear,
  remove,
  openPreview: previewPublicFile,
  handleElementChange
})
</script>

<template>
  <div
    v-bind="$attrs"
    class="x-upload"
    :class="[`x-upload--${mode}`, { 'is-disabled': disabled }]"
    :aria-busy="activeCount > 0"
  >
    <div class="x-upload__controls" :class="`x-upload__controls--${mode}`">
      <ul
        v-if="mode === 'image' && showFileList && files.length"
        class="x-upload__list x-upload__list--image"
      >
        <li
          v-for="file in files"
          :key="file.uid"
          class="x-upload__image"
          :class="`is-${file.status}`"
        >
          <slot name="file" v-bind="fileScope(file)">
            <img
              v-if="file.url"
              class="x-upload__image-thumbnail"
              :src="file.url"
              :alt="file.name"
            /><el-icon v-else class="x-upload__image-placeholder"><Picture /></el-icon>
            <div
              v-if="file.status === 'uploading' || file.status === 'queued'"
              class="x-upload__image-progress"
            >
              <el-progress
                type="circle"
                :percentage="file.percentage"
                :width="56"
                :stroke-width="4"
              />
            </div>
            <div class="x-upload__image-actions">
              <el-button
                v-if="file.url"
                link
                :icon="View"
                :aria-label="business.t('common.preview')"
                @click.stop="openPreview(file)"
              /><el-button
                v-if="file.status === 'error'"
                link
                :icon="RefreshRight"
                :aria-label="business.t('common.retry')"
                @click.stop="retry(file.uid)"
              /><el-button
                v-if="file.status === 'queued' || file.status === 'uploading'"
                link
                :icon="VideoPause"
                :aria-label="business.t('upload.cancelUpload')"
                @click.stop="abort(file.uid)"
              /><el-button
                link
                :icon="Delete"
                :aria-label="business.t('common.remove')"
                :disabled="disabled"
                @click.stop="remove(file.uid)"
              />
            </div>
            <div v-if="file.status === 'error'" class="x-upload__image-error">
              <el-icon><WarningFilled /></el-icon
              ><span>{{ file.errorMessage || business.t('upload.failed') }}</span>
            </div>
          </slot>
        </li>
      </ul>
      <el-upload
        v-if="!selectorHidden"
        ref="selectorRef"
        class="x-upload__selector"
        :class="{ 'is-drag': drag }"
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        :multiple="multiple"
        :drag="drag"
        :accept="resolvedAccept"
        :disabled="disabled"
        :list-type="mode === 'image' && !drag ? 'picture-card' : 'text'"
        :http-request="noopUploadRequest"
        @change="handleElementChange as any"
      >
        <slot name="trigger" :disabled="disabled" :files="files.map(snapshot)">
          <div v-if="drag" class="x-upload__drag-content">
            <el-icon class="x-upload__drag-icon"><UploadFilled /></el-icon>
            <div class="x-upload__drag-text">
              {{ business.t('upload.dropText') }}<span>{{ business.t('upload.clickText') }}</span>
            </div>
          </div>
          <div
            v-else-if="mode === 'image'"
            class="x-upload__image-trigger"
            role="button"
            tabindex="0"
            :aria-label="business.t('upload.selectImage')"
            @keydown.enter.prevent="($event.currentTarget as HTMLElement).click()"
            @keydown.space.prevent="($event.currentTarget as HTMLElement).click()"
          >
            <el-icon><Plus /></el-icon>
          </div>
          <el-button v-else type="primary" size="small" :icon="UploadFilled" :disabled="disabled">{{
            business.t('upload.selectFile')
          }}</el-button>
        </slot>
      </el-upload>
      <ul
        v-if="mode === 'file' && showFileList && files.length"
        class="x-upload__list x-upload__list--file"
      >
        <li
          v-for="file in files"
          :key="file.uid"
          class="x-upload__file"
          :class="`is-${file.status}`"
        >
          <slot name="file" v-bind="fileScope(file)">
            <el-icon class="x-upload__file-icon"><Document /></el-icon>
            <div class="x-upload__file-main">
              <div class="x-upload__file-name" :title="file.name">{{ file.name }}</div>
              <div class="x-upload__file-meta">
                {{ [formatFileSize(file.size), statusText(file)].filter(Boolean).join(' · ') }}
              </div>
              <el-progress
                v-if="file.status === 'uploading'"
                :percentage="file.percentage"
                :stroke-width="4"
                :show-text="false"
              /><slot
                v-if="file.errorMessage"
                name="error"
                type="upload"
                :message="file.errorMessage"
                :file="snapshot(file)"
                ><div class="x-upload__file-error">{{ file.errorMessage }}</div></slot
              >
            </div>
            <div class="x-upload__file-actions">
              <el-button
                v-if="file.url"
                link
                :icon="View"
                :aria-label="business.t('common.preview')"
                @click.stop="openPreview(file)"
              /><el-button
                v-if="file.status === 'error'"
                link
                :icon="RefreshRight"
                :aria-label="business.t('common.retry')"
                @click.stop="retry(file.uid)"
              /><el-button
                v-if="file.status === 'queued' || file.status === 'uploading'"
                link
                :icon="VideoPause"
                :aria-label="business.t('upload.cancelUpload')"
                @click.stop="abort(file.uid)"
              /><el-button
                link
                :icon="Delete"
                :aria-label="business.t('common.remove')"
                :disabled="disabled"
                @click.stop="remove(file.uid)"
              />
            </div>
          </slot>
        </li>
      </ul>
    </div>
    <div v-if="$slots.tip" class="x-upload__tip"><slot name="tip" /></div>
    <slot v-if="validationMessage" name="error" type="validation" :message="validationMessage"
      ><div class="x-upload__validation-error" role="alert">{{ validationMessage }}</div></slot
    >
    <el-dialog
      v-if="previewFile?.url"
      v-model="previewVisible"
      append-to-body
      class="x-upload__preview-dialog"
      :title="previewFile.name"
      @close="closePreview"
    >
      <slot
        name="preview"
        :file="snapshot(previewFile)"
        :item="previewFile.item"
        :close="closePreview"
        ><img class="x-upload__preview-image" :src="previewFile.url" :alt="previewFile.name"
      /></slot>
    </el-dialog>
  </div>
</template>
