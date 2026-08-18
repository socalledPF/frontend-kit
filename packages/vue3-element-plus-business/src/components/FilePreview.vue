<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Download, Refresh } from '@element-plus/icons-vue'
import { downloadBlob } from '@amusite/utils'
import type { FilePreviewItem, FilePreviewKind } from '@amusite/business-core'
import { useBusinessContext } from '../context'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    file?: FilePreviewItem
    kind?: FilePreviewKind | 'auto'
    text?: string
    loadText?: (file: FilePreviewItem, signal?: AbortSignal) => string | Promise<string>
    download?: (file: FilePreviewItem) => unknown | Promise<unknown>
    allowDownload?: boolean
    title?: string
    width?: string
    appendToBody?: boolean
  }>(),
  {
    modelValue: false,
    file: () => ({ name: '' }),
    kind: 'auto',
    text: '',
    allowDownload: true,
    title: '',
    width: '76vw',
    appendToBody: true
  }
)
const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  open: [file: FilePreviewItem]
  close: []
  download: [file: FilePreviewItem]
  error: [error: unknown, action: 'preview' | 'download']
}>()
defineSlots<{
  default?: (scope: {
    file: FilePreviewItem
    kind: FilePreviewKind
    url: string
    text: string
    loading: boolean
  }) => unknown
  unsupported?: (scope: { file: FilePreviewItem }) => unknown
  footer?: () => unknown
}>()
const business = useBusinessContext()
const textContent = ref('')
const loading = ref(false)
const objectUrl = ref('')
let controller: AbortController | undefined
const extension = computed(() => props.file.name.split('.').pop()?.toLowerCase() || '')
const resolvedKind = computed<FilePreviewKind>(() => {
  if (props.kind !== 'auto') return props.kind
  const type = props.file.type || ''
  if (
    type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension.value)
  )
    return 'image'
  if (type === 'application/pdf' || extension.value === 'pdf') return 'pdf'
  if (type.startsWith('video/') || ['mp4', 'webm', 'ogg'].includes(extension.value)) return 'video'
  if (type.startsWith('audio/') || ['mp3', 'wav', 'm4a'].includes(extension.value)) return 'audio'
  if (
    type.startsWith('text/') ||
    ['txt', 'csv', 'json', 'xml', 'log', 'md'].includes(extension.value)
  )
    return 'text'
  return 'unsupported'
})
function releaseObjectUrl() {
  if (objectUrl.value && typeof URL !== 'undefined') URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = ''
}
const sourceUrl = computed(() => props.file.url || objectUrl.value)
async function load() {
  releaseObjectUrl()
  controller?.abort()
  controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
  if (
    !props.file.url &&
    typeof Blob !== 'undefined' &&
    props.file.data instanceof Blob &&
    typeof URL !== 'undefined'
  )
    objectUrl.value = URL.createObjectURL(props.file.data)
  if (resolvedKind.value !== 'text') return
  textContent.value = props.text
  if (!props.loadText || props.text) return
  loading.value = true
  try {
    textContent.value = await props.loadText(props.file, controller?.signal)
  } catch (error) {
    if (!controller?.signal.aborted) {
      business.notifyError?.(error, { source: 'FilePreview', action: 'preview' })
      emit('error', error, 'preview')
    }
  } finally {
    loading.value = false
  }
}
async function downloadFile() {
  try {
    if (props.download) await props.download(props.file)
    else if (business.download && props.file.data !== undefined)
      await business.download({
        data: props.file.data,
        fileName: props.file.name,
        type: props.file.type
      })
    else if (props.file.data !== undefined)
      downloadBlob(props.file.data, props.file.name, { type: props.file.type })
    else if (props.file.url && typeof document !== 'undefined') {
      const link = document.createElement('a')
      link.href = props.file.url
      link.download = props.file.name
      link.rel = 'noopener'
      link.click()
    }
    emit('download', props.file)
  } catch (error) {
    business.notifyError?.(error, { source: 'FilePreview', action: 'download' })
    emit('error', error, 'download')
  }
}
watch(
  () => [props.modelValue, props.file, props.kind, props.text],
  ([visible]) => {
    if (visible) {
      void load()
      emit('open', props.file)
    }
  },
  { deep: true, immediate: true }
)
function close() {
  emit('update:modelValue', false)
  emit('close')
}
onBeforeUnmount(() => {
  controller?.abort()
  releaseObjectUrl()
})
defineExpose({
  kind: resolvedKind,
  sourceUrl,
  loading,
  reload: load,
  download: downloadFile,
  close
})
</script>

<template>
  <el-dialog
    v-bind="$attrs"
    class="x-file-preview"
    :model-value="modelValue"
    :title="title || file.name || business.t('preview.title')"
    :width="width"
    :append-to-body="appendToBody"
    destroy-on-close
    @update:model-value="$event ? emit('update:modelValue', true) : close()"
  >
    <slot :file="file" :kind="resolvedKind" :url="sourceUrl" :text="textContent" :loading="loading">
      <div v-loading="loading" class="x-file-preview__body">
        <img
          v-if="resolvedKind === 'image' && sourceUrl"
          class="x-file-preview__image"
          :src="sourceUrl"
          :alt="file.name"
        />
        <iframe
          v-else-if="resolvedKind === 'pdf' && sourceUrl"
          class="x-file-preview__frame"
          :src="sourceUrl"
          :title="file.name"
        />
        <video
          v-else-if="resolvedKind === 'video' && sourceUrl"
          class="x-file-preview__media"
          :src="sourceUrl"
          controls
        />
        <audio
          v-else-if="resolvedKind === 'audio' && sourceUrl"
          class="x-file-preview__audio"
          :src="sourceUrl"
          controls
        />
        <pre v-else-if="resolvedKind === 'text'" class="x-file-preview__text">{{
          textContent
        }}</pre>
        <slot v-else name="unsupported" :file="file"
          ><el-empty :description="business.t('preview.unsupported')"
        /></slot>
      </div>
    </slot>
    <template #footer
      ><div class="x-file-preview__footer">
        <slot name="footer"
          ><el-button :icon="Refresh" @click="load">{{ business.t('table.refresh') }}</el-button
          ><el-button v-if="allowDownload" type="primary" :icon="Download" @click="downloadFile">{{
            business.t('preview.download')
          }}</el-button></slot
        >
      </div></template
    >
  </el-dialog>
</template>
