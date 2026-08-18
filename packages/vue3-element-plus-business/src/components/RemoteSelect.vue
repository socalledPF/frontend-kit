<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { BusinessDictOption, DictValue, RemoteSelectRequest } from '@amusite/business-core'
import { useBusinessContext } from '../context'

const props = withDefaults(
  defineProps<{
    modelValue?: DictValue | DictValue[]
    request: RemoteSelectRequest
    options?: BusinessDictOption[]
    multiple?: boolean
    clearable?: boolean
    filterable?: boolean
    disabled?: boolean
    placeholder?: string
    size?: string
    debounce?: number
    minChars?: number
    cache?: boolean
    loadOnFocus?: boolean
  }>(),
  {
    options: () => [],
    multiple: false,
    clearable: true,
    filterable: true,
    disabled: false,
    placeholder: '',
    size: undefined,
    debounce: 250,
    minChars: 0,
    cache: true,
    loadOnFocus: true
  }
)
const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  change: [value: unknown]
  load: [options: BusinessDictOption[], keyword: string]
  error: [error: unknown, keyword: string]
  'loading-change': [value: boolean]
}>()
defineSlots<{
  option?: (scope: { option: BusinessDictOption; index: number }) => unknown
  empty?: () => unknown
}>()
const business = useBusinessContext()
const value = computed({
  get: () => props.modelValue,
  set: (next) => emit('update:modelValue', next)
})
const remoteOptions = ref<BusinessDictOption[]>([...props.options])
const loading = ref(false)
const cacheStore = new Map<string, BusinessDictOption[]>()
let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
let requestId = 0
watch(
  () => props.options,
  (options) => {
    if (!loading.value) remoteOptions.value = [...options]
  },
  { deep: true }
)

function setLoading(next: boolean) {
  if (loading.value !== next) {
    loading.value = next
    emit('loading-change', next)
  }
}
async function load(keyword = '', force = false) {
  const normalized = keyword.trim()
  if (normalized.length < props.minChars) {
    remoteOptions.value = [...props.options]
    return remoteOptions.value
  }
  if (!force && props.cache && cacheStore.has(normalized)) {
    remoteOptions.value = [...cacheStore.get(normalized)!]
    return remoteOptions.value
  }
  controller?.abort()
  controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
  const current = ++requestId
  setLoading(true)
  try {
    const options = await props.request(normalized, {
      keyword: normalized,
      requestId: current,
      signal: controller?.signal
    })
    if (current !== requestId) return remoteOptions.value
    remoteOptions.value = Array.isArray(options) ? [...options] : []
    if (props.cache) cacheStore.set(normalized, [...remoteOptions.value])
    emit('load', [...remoteOptions.value], normalized)
    return remoteOptions.value
  } catch (error) {
    if (current !== requestId || controller?.signal.aborted) return remoteOptions.value
    business.notifyError?.(error, {
      source: 'RemoteSelect',
      action: 'load',
      metadata: { keyword: normalized }
    })
    emit('error', error, normalized)
    throw error
  } finally {
    if (current === requestId) setLoading(false)
  }
}
function remoteMethod(keyword: string) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void load(keyword).catch(() => undefined), Math.max(0, props.debounce))
}
function clearCache(keyword?: string) {
  if (keyword === undefined) cacheStore.clear()
  else cacheStore.delete(keyword.trim())
}
function handleFocus() {
  if (props.loadOnFocus && remoteOptions.value.length === 0) void load('').catch(() => undefined)
}
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  controller?.abort()
  requestId += 1
})
defineExpose({
  load,
  refresh: (keyword = '') => load(keyword, true),
  clearCache,
  options: remoteOptions,
  loading
})
</script>

<template>
  <el-select
    v-bind="$attrs"
    v-model="value"
    class="x-remote-select"
    remote
    :remote-method="remoteMethod"
    :multiple="multiple"
    :clearable="clearable"
    :filterable="filterable"
    :disabled="disabled"
    :loading="loading"
    :placeholder="placeholder || business.t('dict.placeholder')"
    :size="size as any"
    @focus="handleFocus"
    @change="emit('change', $event)"
  >
    <el-option
      v-for="(option, index) in remoteOptions"
      :key="String(option.value)"
      :label="option.label"
      :value="option.value"
      :disabled="option.disabled"
      ><slot name="option" :option="option" :index="index"
    /></el-option>
    <template v-if="$slots.empty" #empty><slot name="empty" /></template>
  </el-select>
</template>
