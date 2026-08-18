<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Delete, Document, UploadFilled } from '@element-plus/icons-vue'
import {
  clampPercentage,
  formatFileSize,
  getErrorMessage,
  matchesFileAccept
} from '@amusite/business-core'
import type {
  ImportData,
  ImportRequest,
  ImportResult,
  ImportValidationError,
  ImportValidationErrorCode
} from '@amusite/business-core'
import { useBusinessContext } from '../context'

const MB = 1024 * 1024
const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    request: ImportRequest
    title?: string
    width?: string
    accept?: string
    maxSizeMb?: number
    fieldName?: string
    data?: ImportData
    beforeImport?: (file: File, updateExisting: boolean) => boolean | Promise<boolean>
    updateExisting?: boolean
    showUpdateExisting?: boolean
    updateExistingText?: string
    templateUrl?: string
    templateDownload?: () => unknown | Promise<unknown>
    confirmText?: string
    cancelText?: string
    closeOnSuccess?: boolean
    resetOnClose?: boolean
    appendToBody?: boolean
    disabled?: boolean
  }>(),
  {
    modelValue: false,
    title: '',
    width: '520px',
    accept: '.xlsx,.xls',
    maxSizeMb: 10,
    fieldName: 'file',
    data: () => ({}),
    updateExisting: false,
    showUpdateExisting: false,
    updateExistingText: '',
    templateUrl: '',
    confirmText: '',
    cancelText: '',
    closeOnSuccess: false,
    resetOnClose: true,
    appendToBody: false,
    disabled: false
  }
)
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:updateExisting': [value: boolean]
  'validation-error': [detail: ImportValidationError]
  select: [file: File]
  progress: [percentage: number, file: File]
  success: [result: ImportResult, file: File]
  error: [error: unknown, file: File]
  cancel: [file?: File]
  clear: []
  'loading-change': [value: boolean]
  'template-success': []
  'template-error': [error: unknown]
  open: []
  closed: []
}>()
const uploadRef = ref<{ clearFiles?: () => void }>()
const business = useBusinessContext()
const selectedFile = ref<File>()
const status = ref<'ready' | 'uploading' | 'success' | 'error'>('ready')
const percentage = ref(0)
const result = ref<ImportResult>()
const errorMessage = ref('')
const validationMessage = ref('')
const innerUpdateExisting = ref(false)
const templateLoading = ref(false)
const importing = computed(() => status.value === 'uploading')
const resultType = computed(() =>
  Number(result.value?.failureCount || 0) > 0 ? 'warning' : 'success'
)
let controller: AbortController | undefined
let runId = 0
let currentTask: Promise<ImportResult | undefined> | undefined
let destroyed = false
watch(
  () => props.modelValue,
  (visible) => {
    if (visible) innerUpdateExisting.value = props.updateExisting
    else if (importing.value) abort()
  },
  { immediate: true }
)
watch(
  () => props.updateExisting,
  (value) => {
    innerUpdateExisting.value = value
  }
)
function emitValidationError(
  code: ImportValidationErrorCode,
  message: string,
  file?: File,
  error?: unknown
) {
  const detail = { code, message, file, error }
  validationMessage.value = message
  emit('validation-error', detail)
  return false
}
function validateFile(file: File) {
  if (!matchesFileAccept(file, props.accept))
    return emitValidationError('type', business.t('import.type', { accept: props.accept }), file)
  if (props.maxSizeMb > 0 && file.size > props.maxSizeMb * MB)
    return emitValidationError('size', business.t('import.size', { size: props.maxSizeMb }), file)
  return true
}
function handleFileChange(uploadFile: { raw?: File }) {
  const file = uploadFile.raw
  if (!file || props.disabled || importing.value || !validateFile(file)) {
    uploadRef.value?.clearFiles?.()
    return
  }
  selectedFile.value = file
  status.value = 'ready'
  percentage.value = 0
  result.value = undefined
  errorMessage.value = ''
  validationMessage.value = ''
  uploadRef.value?.clearFiles?.()
  emit('select', file)
}
function resolveData(file: File) {
  return typeof props.data === 'function'
    ? { ...(props.data(file, innerUpdateExisting.value) || {}) }
    : { ...(props.data || {}) }
}
function submit(): Promise<ImportResult | undefined> {
  if (currentTask) return currentTask
  const task = (async () => {
    const file = selectedFile.value
    if (!file) {
      emitValidationError('config', business.t('import.selectFirst'))
      return undefined
    }
    runId += 1
    const currentRun = runId
    const allowed =
      !props.beforeImport || (await props.beforeImport(file, innerUpdateExisting.value)) !== false
    if (currentRun !== runId || destroyed) return undefined
    if (!allowed) {
      emitValidationError('before-import', business.t('import.beforeRejected'), file)
      return undefined
    }
    controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
    status.value = 'uploading'
    percentage.value = 0
    errorMessage.value = ''
    result.value = undefined
    emit('loading-change', true)
    try {
      const response = await props.request({
        file,
        fieldName: props.fieldName,
        data: resolveData(file),
        updateExisting: innerUpdateExisting.value,
        signal: controller?.signal,
        onProgress: (value) => {
          if (currentRun !== runId || destroyed) return
          percentage.value = clampPercentage(value)
          emit('progress', percentage.value, file)
        }
      })
      if (currentRun !== runId || destroyed) return undefined
      percentage.value = 100
      emit('progress', 100, file)
      status.value = 'success'
      result.value = response || {}
      emit('success', result.value, file)
      if (props.closeOnSuccess) emit('update:modelValue', false)
      return result.value
    } catch (error) {
      if (currentRun !== runId || destroyed) return undefined
      status.value = 'error'
      errorMessage.value = getErrorMessage(error, business.t('import.failed'))
      business.notifyError?.(error, {
        source: 'ImportDialog',
        action: 'import',
        metadata: { name: file.name }
      })
      emit('error', error, file)
      throw error
    } finally {
      if (currentRun === runId && !destroyed) {
        controller = undefined
        emit('loading-change', false)
      }
    }
  })()
  currentTask = task
  void task.then(
    () => {
      if (currentTask === task) currentTask = undefined
    },
    () => {
      if (currentTask === task) currentTask = undefined
    }
  )
  return task
}
function abort() {
  if (!importing.value && !currentTask) return
  const file = selectedFile.value
  const active = importing.value
  runId += 1
  controller?.abort()
  controller = undefined
  currentTask = undefined
  status.value = 'ready'
  percentage.value = 0
  if (active) emit('loading-change', false)
  emit('cancel', file)
}
function clear() {
  abort()
  selectedFile.value = undefined
  status.value = 'ready'
  percentage.value = 0
  result.value = undefined
  errorMessage.value = ''
  validationMessage.value = ''
  uploadRef.value?.clearFiles?.()
  emit('clear')
}
function updateExistingValue(value: boolean) {
  innerUpdateExisting.value = value
  emit('update:updateExisting', value)
}
async function handleTemplateDownload() {
  if (!props.templateDownload || templateLoading.value) return
  templateLoading.value = true
  try {
    await props.templateDownload()
    emit('template-success')
  } catch (error) {
    business.notifyError?.(error, { source: 'ImportDialog', action: 'download-template' })
    emit('template-error', error)
  } finally {
    templateLoading.value = false
  }
}
function handleClosed() {
  if (props.resetOnClose) clear()
  emit('closed')
}
const noopUploadRequest = () => Promise.resolve()
onBeforeUnmount(() => {
  destroyed = true
  abort()
})
defineExpose({ selectedFile, status, percentage, result, submit, abort, clear, handleFileChange })
</script>

<template>
  <el-dialog
    v-bind="$attrs"
    class="x-import-dialog"
    :model-value="modelValue"
    :title="title || business.t('import.title')"
    :width="width"
    :append-to-body="appendToBody"
    :close-on-click-modal="false"
    :close-on-press-escape="!importing"
    :before-close="
      (done: () => void) => {
        if (!importing) done()
      }
    "
    @update:model-value="emit('update:modelValue', $event)"
    @open="emit('open')"
    @closed="handleClosed"
  >
    <div
      v-if="templateDownload || templateUrl || $slots.template"
      class="x-import-dialog__template"
    >
      <span>{{ business.t('import.templateHint') }}</span
      ><slot name="template"
        ><el-button
          v-if="templateDownload"
          link
          type="primary"
          :loading="templateLoading"
          @click="handleTemplateDownload"
          >{{ business.t('import.downloadTemplate') }}</el-button
        ><a v-else class="x-import-dialog__template-link" :href="templateUrl" download>{{
          business.t('import.downloadTemplate')
        }}</a></slot
      >
    </div>
    <el-upload
      ref="uploadRef"
      class="x-import-dialog__upload"
      drag
      action="#"
      :accept="accept"
      :auto-upload="false"
      :show-file-list="false"
      :disabled="disabled || importing"
      :http-request="noopUploadRequest"
      @change="handleFileChange as any"
    >
      <el-icon class="x-import-dialog__upload-icon"><UploadFilled /></el-icon>
      <div class="el-upload__text">
        {{ business.t('upload.dropText') }}<em>{{ business.t('upload.clickText') }}</em>
      </div>
    </el-upload>
    <div class="x-import-dialog__tip">
      <slot name="tip">{{ business.t('import.supportTip', { accept, size: maxSizeMb }) }}</slot>
    </div>
    <div v-if="selectedFile" class="x-import-dialog__file">
      <el-icon class="x-import-dialog__file-icon"><Document /></el-icon>
      <div class="x-import-dialog__file-main">
        <div class="x-import-dialog__file-name">{{ selectedFile.name }}</div>
        <div class="x-import-dialog__file-size">{{ formatFileSize(selectedFile.size) }}</div>
        <el-progress v-if="importing" :percentage="percentage" :stroke-width="4" />
      </div>
      <el-button
        link
        class="x-import-dialog__remove"
        :icon="Delete"
        :disabled="importing"
        :aria-label="business.t('common.remove')"
        @click="clear"
      />
    </div>
    <el-checkbox
      v-if="showUpdateExisting"
      class="x-import-dialog__update-existing"
      :model-value="innerUpdateExisting"
      :disabled="importing"
      @update:model-value="updateExistingValue(Boolean($event))"
      >{{ updateExistingText || business.t('import.updateExisting') }}</el-checkbox
    >
    <div v-if="validationMessage" class="x-import-dialog__validation-error">
      {{ validationMessage }}
    </div>
    <el-alert
      v-if="errorMessage"
      class="x-import-dialog__request-error"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon
    />
    <div v-if="result" class="x-import-dialog__result">
      <el-alert
        :title="
          result.message ||
          [
            result.successCount !== undefined
              ? business.t('import.successCount', { count: result.successCount })
              : '',
            result.failureCount !== undefined
              ? business.t('import.failureCount', { count: result.failureCount })
              : ''
          ]
            .filter(Boolean)
            .join('，') ||
          business.t('import.completed')
        "
        :type="resultType"
        :closable="false"
        show-icon
      />
      <ul v-if="result.errors?.length" class="x-import-dialog__error-list">
        <li v-for="(item, index) in result.errors" :key="`${item.row || 'row'}-${index}`">
          {{ item.row ? business.t('import.rowError', { row: item.row }) : '' }}{{ item.message }}
        </li>
      </ul>
    </div>
    <template #footer
      ><div class="x-import-dialog__footer">
        <el-button size="small" :disabled="importing" @click="emit('update:modelValue', false)">{{
          cancelText || business.t('common.cancel')
        }}</el-button
        ><el-button
          type="primary"
          size="small"
          :loading="importing"
          :disabled="disabled || !selectedFile"
          @click="submit().catch(() => undefined)"
          >{{
            status === 'error'
              ? business.t('common.retry')
              : confirmText || business.t('import.start')
          }}</el-button
        >
      </div></template
    >
  </el-dialog>
</template>
