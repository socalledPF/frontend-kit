<script setup lang="ts">
import { ref } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { downloadBlob } from '@amusite/utils'
import type { ExportFile, ExportResult } from '@amusite/business-core'
import AsyncButton from './AsyncButton.vue'
import { useBusinessContext } from '../context'

const props = withDefaults(
  defineProps<{
    request: (...args: unknown[]) => unknown | Promise<unknown>
    fileName?: string | ((file: ExportFile, ...args: unknown[]) => string)
    transformResult?: (result: unknown, ...args: unknown[]) => ExportResult | Promise<ExportResult>
    download?: (file: ExportFile, ...args: unknown[]) => unknown | Promise<unknown>
    autoDownload?: boolean
    beforeExport?: (...args: unknown[]) => boolean | Promise<boolean>
    confirm?: boolean | string | ((...args: unknown[]) => boolean | Promise<boolean>)
    confirmOptions?: Record<string, unknown>
    loading?: boolean
    disabled?: boolean
    type?: string
    size?: string
    icon?: string | object
    plain?: boolean
  }>(),
  {
    fileName: 'export.xlsx',
    autoDownload: true,
    confirm: false,
    confirmOptions: () => ({}),
    loading: undefined,
    disabled: false,
    type: 'primary',
    size: 'small',
    icon: () => Download,
    plain: false
  }
)
const emit = defineEmits<{
  click: [event: MouseEvent]
  download: [file: ExportFile, ...args: unknown[]]
  'loading-change': [value: boolean]
  success: [result: ExportFile, ...args: unknown[]]
  error: [error: unknown, ...args: unknown[]]
  cancel: [...args: unknown[]]
}>()
const buttonRef = ref<{ execute: (...args: unknown[]) => Promise<unknown> }>()
const business = useBusinessContext()
function isExportFile(value: ExportResult): value is ExportFile {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !(typeof Blob !== 'undefined' && value instanceof Blob) &&
    !(value instanceof ArrayBuffer) &&
    Object.prototype.hasOwnProperty.call(value, 'data')
  )
}
function resolveFile(result: ExportResult, args: unknown[]) {
  const file = isExportFile(result) ? result : { data: result }
  const configured =
    typeof props.fileName === 'function' ? props.fileName(file, ...args) : props.fileName
  return { ...file, fileName: file.fileName || configured || 'export.xlsx' }
}
async function runExport(...args: unknown[]) {
  const raw = await props.request(...args)
  const result = props.transformResult
    ? await props.transformResult(raw, ...args)
    : (raw as ExportResult)
  const file = resolveFile(result, args)
  if (props.autoDownload) {
    if (props.download) await props.download(file, ...args)
    else if (business.download) await business.download(file)
    else downloadBlob(file.data, file.fileName || 'export.xlsx', { type: file.type })
    emit('download', file, ...args)
  }
  return file
}
function execute(...args: unknown[]) {
  return buttonRef.value?.execute(...args) ?? Promise.resolve(undefined)
}
defineExpose({ execute })
</script>

<template>
  <AsyncButton
    ref="buttonRef"
    v-bind="$attrs"
    class="x-export-button"
    :action="runExport"
    :before-action="beforeExport"
    :confirm="confirm"
    :confirm-options="confirmOptions"
    :loading="loading"
    :disabled="disabled"
    :type="type"
    :size="size"
    :icon="icon"
    :plain="plain"
    @click="emit('click', $event)"
    @loading-change="emit('loading-change', $event)"
    @success="
      (result: unknown, ...args: unknown[]) => emit('success', result as ExportFile, ...args)
    "
    @error="(error: unknown, ...args: unknown[]) => emit('error', error, ...args)"
    @cancel="(...args: unknown[]) => emit('cancel', ...args)"
  >
    <template #default="scope"
      ><slot v-bind="scope">{{ business.t('export.action') }}</slot></template
    >
  </AsyncButton>
</template>
