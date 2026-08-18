<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { AsyncButtonConfirm } from '@amusite/business-core'
import { useBusinessContext } from '../context'

const props = withDefaults(
  defineProps<{
    action: (...args: unknown[]) => unknown | Promise<unknown>
    confirm?: AsyncButtonConfirm
    confirmOptions?: Record<string, unknown>
    beforeAction?: (...args: unknown[]) => boolean | Promise<boolean>
    loading?: boolean
    lock?: boolean
    disabled?: boolean
    type?: string
    size?: string
    icon?: string | object
    plain?: boolean
    round?: boolean
    circle?: boolean
    nativeType?: 'button' | 'submit' | 'reset'
  }>(),
  {
    confirm: false,
    confirmOptions: () => ({}),
    loading: undefined,
    lock: true,
    disabled: false,
    type: 'default',
    size: 'small',
    icon: '',
    plain: false,
    round: false,
    circle: false,
    nativeType: 'button'
  }
)
const emit = defineEmits<{
  click: [event: MouseEvent]
  cancel: [eventOrArg?: unknown, ...args: unknown[]]
  success: [result: unknown, ...args: unknown[]]
  error: [error: unknown, ...args: unknown[]]
  'loading-change': [value: boolean]
}>()
defineSlots<{
  default?: (scope: {
    loading: boolean
    execute: (...args: unknown[]) => Promise<unknown>
  }) => unknown
}>()
const innerLoading = ref(false)
const business = useBusinessContext()
const runningCount = ref(0)
let currentTask: Promise<unknown> | undefined
const displayedLoading = computed(() =>
  typeof props.loading === 'boolean' ? props.loading : innerLoading.value
)

function setInnerLoading(value: boolean) {
  if (innerLoading.value === value) return
  innerLoading.value = value
  emit('loading-change', value)
}
async function resolveConfirmation(args: unknown[]) {
  if (!props.confirm) return true
  if (typeof props.confirm === 'function') return (await props.confirm(...args)) !== false
  const message =
    typeof props.confirm === 'string' ? props.confirm : business.t('common.confirmAction')
  try {
    if (business.confirm) {
      return (
        (await business.confirm({
          message,
          title: String(props.confirmOptions.title || business.t('common.confirmTitle')),
          type: 'warning',
          raw: props.confirmOptions
        })) !== false
      )
    }
    await ElMessageBox.confirm(
      message,
      String(props.confirmOptions.title || business.t('common.confirmTitle')),
      props.confirmOptions
    )
    return true
  } catch {
    return false
  }
}
function execute(...args: unknown[]): Promise<unknown> {
  if (props.lock && currentTask) return currentTask
  if (props.lock && displayedLoading.value) return Promise.resolve(undefined)
  const task = (async () => {
    const startedAt = Date.now()
    business.telemetry?.({ name: 'async-button', phase: 'start' })
    try {
      if (
        !(await resolveConfirmation(args)) ||
        (props.beforeAction && (await props.beforeAction(...args)) === false)
      ) {
        emit('cancel', ...args)
        return undefined
      }
      runningCount.value += 1
      setInnerLoading(true)
      const result = await props.action(...args)
      business.telemetry?.({
        name: 'async-button',
        phase: 'success',
        durationMs: Date.now() - startedAt
      })
      emit('success', result, ...args)
      return result
    } catch (error) {
      business.notifyError?.(error, { source: 'AsyncButton', action: 'execute' })
      business.telemetry?.({
        name: 'async-button',
        phase: 'error',
        durationMs: Date.now() - startedAt,
        error
      })
      emit('error', error, ...args)
      throw error
    } finally {
      if (runningCount.value > 0) runningCount.value -= 1
      setInnerLoading(runningCount.value > 0)
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
function handleClick(event: MouseEvent) {
  emit('click', event)
  void execute(event).catch(() => undefined)
}
defineExpose({ execute, displayedLoading })
</script>

<template>
  <el-button
    v-bind="$attrs"
    :type="type as any"
    :size="size as any"
    :icon="icon || undefined"
    :plain="plain"
    :round="round"
    :circle="circle"
    :native-type="nativeType"
    :loading="displayedLoading"
    :disabled="disabled || (lock && displayedLoading)"
    @click="handleClick"
  >
    <slot :loading="displayedLoading" :execute="execute">{{ business.t('common.submit') }}</slot>
  </el-button>
</template>
