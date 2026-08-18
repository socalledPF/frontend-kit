<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useBusinessContext } from '../context'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | boolean
    request?: (value: unknown, previousValue: unknown) => unknown | Promise<unknown>
    confirm?:
      boolean | string | ((value: unknown, previousValue: unknown) => boolean | Promise<boolean>)
    activeValue?: string | number | boolean
    inactiveValue?: string | number | boolean
    activeText?: string
    inactiveText?: string
    disabled?: boolean
    optimistic?: boolean
    size?: string
  }>(),
  {
    modelValue: false,
    confirm: false,
    activeValue: true,
    inactiveValue: false,
    activeText: '',
    inactiveText: '',
    disabled: false,
    optimistic: true,
    size: undefined
  }
)
const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  change: [value: unknown, previousValue: unknown]
  success: [result: unknown, value: unknown, previousValue: unknown]
  error: [error: unknown, value: unknown, previousValue: unknown]
  cancel: [value: unknown, previousValue: unknown]
  rollback: [previousValue: unknown, value: unknown]
  'loading-change': [value: boolean]
}>()
const business = useBusinessContext()
const value = ref<unknown>(props.modelValue)
const loading = ref(false)
watch(
  () => props.modelValue,
  (next) => {
    if (!loading.value) value.value = next
  }
)
async function confirmChange(next: unknown, previous: unknown) {
  if (!props.confirm) return true
  if (typeof props.confirm === 'function') return (await props.confirm(next, previous)) !== false
  const message =
    typeof props.confirm === 'string' ? props.confirm : business.t('status.confirmChange')
  if (business.confirm)
    return (
      (await business.confirm({
        message,
        title: business.t('common.confirmTitle'),
        type: 'warning'
      })) !== false
    )
  try {
    await ElMessageBox.confirm(message, business.t('common.confirmTitle'), { type: 'warning' })
    return true
  } catch {
    return false
  }
}
function setLoading(next: boolean) {
  loading.value = next
  emit('loading-change', next)
}
async function update(next: unknown) {
  if (loading.value || props.disabled) return
  const previous = props.modelValue
  if (props.optimistic) {
    value.value = next
    emit('update:modelValue', next)
  }
  if (!(await confirmChange(next, previous))) {
    value.value = previous
    if (props.optimistic) emit('update:modelValue', previous)
    emit('cancel', next, previous)
    return
  }
  setLoading(true)
  try {
    const result = await props.request?.(next, previous)
    value.value = next
    if (!props.optimistic) emit('update:modelValue', next)
    emit('change', next, previous)
    emit('success', result, next, previous)
  } catch (error) {
    value.value = previous
    emit('update:modelValue', previous)
    emit('rollback', previous, next)
    business.notifyError?.(error, { source: 'StatusSwitch', action: 'change' })
    emit('error', error, next, previous)
  } finally {
    setLoading(false)
  }
}
defineExpose({ loading, update })
</script>

<template>
  <el-switch
    v-bind="$attrs"
    :model-value="value"
    class="x-status-switch"
    :loading="loading"
    :disabled="disabled || loading"
    :active-value="activeValue"
    :inactive-value="inactiveValue"
    :active-text="activeText"
    :inactive-text="inactiveText"
    :size="size as any"
    @update:model-value="update"
  />
</template>
