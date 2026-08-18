<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { cloneValue, isEqualValue } from '@amusite/business-core'
import type {
  FormDialogBeforeClose,
  FormDialogCloseContext,
  FormDialogMode,
  FormDialogSubmit
} from '@amusite/business-core'
import { useBusinessContext } from '../context'

type FormModel = Record<string, unknown>
type CloseReason = FormDialogCloseContext['reason']
const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    model?: FormModel
    title?: string
    mode?: FormDialogMode
    submit?: FormDialogSubmit
    rules?: Record<string, unknown>
    size?: string | number
    direction?: 'rtl' | 'ltr' | 'ttb' | 'btt'
    labelWidth?: string
    labelPosition?: 'left' | 'right' | 'top'
    confirmText?: string
    cancelText?: string
    closeOnSuccess?: boolean
    resetOnClose?: boolean
    destroyOnClose?: boolean
    closeOnClickModal?: boolean
    closeOnPressEscape?: boolean
    appendToBody?: boolean
    confirmClose?:
      boolean | string | ((context: FormDialogCloseContext) => boolean | Promise<boolean>)
    beforeClose?: FormDialogBeforeClose
    disabled?: boolean
    formProps?: Record<string, unknown>
  }>(),
  {
    modelValue: false,
    model: () => ({}),
    title: '',
    mode: 'create',
    rules: () => ({}),
    size: '480px',
    direction: 'rtl',
    labelWidth: '96px',
    labelPosition: 'right',
    confirmText: '',
    cancelText: '',
    closeOnSuccess: true,
    resetOnClose: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    closeOnPressEscape: true,
    appendToBody: false,
    confirmClose: false,
    disabled: false,
    formProps: () => ({})
  }
)
const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  'update:model': [model: FormModel]
  'dirty-change': [dirty: boolean]
  'loading-change': [loading: boolean]
  reset: [model: FormModel]
  submit: [model: FormModel, context: { mode: FormDialogMode; model: FormModel }]
  success: [result: unknown, model: FormModel]
  error: [error: unknown, model: FormModel]
  cancel: [context: FormDialogCloseContext]
  open: []
  closed: []
}>()
defineSlots<{
  default?: (scope: {
    model: FormModel
    mode: FormDialogMode
    submitting: boolean
    dirty: boolean
  }) => unknown
  header?: () => unknown
  footer?: (scope: {
    model: FormModel
    submitting: boolean
    dirty: boolean
    submit: () => Promise<unknown>
    close: () => Promise<boolean>
    reset: () => void
  }) => unknown
}>()
const business = useBusinessContext()
const formRef = ref<{
  clearValidate?: () => void
  validate?: (callback: (valid: boolean) => void) => void
}>()
const innerModel = ref<FormModel>({})
const initial = ref<FormModel>({})
const dirty = ref(false)
const submitting = ref(false)
let syncing = false
let task: Promise<unknown> | undefined
function initialize() {
  innerModel.value = cloneValue(props.model)
  initial.value = cloneValue(props.model)
  dirty.value = false
  void nextTick(() => formRef.value?.clearValidate?.())
}
watch(
  () => props.modelValue,
  (visible) => {
    if (visible) initialize()
  },
  { immediate: true }
)
watch(
  () => props.model,
  (model) => {
    if (!syncing && !isEqualValue(model, innerModel.value)) initialize()
  },
  { deep: true }
)
watch(
  innerModel,
  (model) => {
    const next = !isEqualValue(model, initial.value)
    if (next !== dirty.value) {
      dirty.value = next
      emit('dirty-change', next)
    }
    syncing = true
    emit('update:model', cloneValue(model))
    void nextTick(() => {
      syncing = false
    })
  },
  { deep: true }
)
function context(reason: CloseReason): FormDialogCloseContext {
  return {
    mode: props.mode,
    model: cloneValue(innerModel.value),
    dirty: dirty.value,
    submitting: submitting.value,
    reason
  }
}
function resetFields() {
  innerModel.value = cloneValue(initial.value)
  dirty.value = false
  emit('update:model', cloneValue(innerModel.value))
  emit('dirty-change', false)
  emit('reset', cloneValue(innerModel.value))
  void nextTick(() => formRef.value?.clearValidate?.())
}
function validate() {
  if (!formRef.value?.validate) return Promise.resolve(true)
  return new Promise<boolean>((resolve) => formRef.value?.validate?.(resolve))
}
async function requestClose(reason: CloseReason = 'close') {
  const details = context(reason)
  if (props.beforeClose && (await props.beforeClose(details)) === false) return false
  if (dirty.value && reason !== 'success' && props.confirmClose) {
    if (typeof props.confirmClose === 'function' && (await props.confirmClose(details)) === false)
      return false
    if (typeof props.confirmClose !== 'function') {
      const message =
        typeof props.confirmClose === 'string'
          ? props.confirmClose
          : business.t('form.unsavedConfirm')
      try {
        if (business.confirm) {
          if (
            (await business.confirm({
              message,
              title: business.t('common.confirmTitle'),
              type: 'warning'
            })) === false
          )
            return false
        } else
          await ElMessageBox.confirm(message, business.t('common.confirmTitle'), {
            type: 'warning'
          })
      } catch {
        return false
      }
    }
  }
  if (reason === 'cancel') emit('cancel', details)
  emit('update:modelValue', false)
  return true
}
function submitForm(): Promise<unknown> {
  if (task) return task
  task = (async () => {
    if (!(await validate())) return undefined
    const model = cloneValue(innerModel.value)
    const details = { mode: props.mode, model }
    emit('submit', model, details)
    if (!props.submit) return model
    submitting.value = true
    emit('loading-change', true)
    try {
      const result = await props.submit(model, details)
      initial.value = cloneValue(innerModel.value)
      dirty.value = false
      emit('dirty-change', false)
      emit('success', result, model)
      if (props.closeOnSuccess) await requestClose('success')
      return result
    } catch (error) {
      business.notifyError?.(error, { source: 'DrawerForm', action: 'submit' })
      emit('error', error, model)
      throw error
    } finally {
      submitting.value = false
      emit('loading-change', false)
    }
  })()
  void task
    .finally(() => {
      task = undefined
    })
    .catch(() => undefined)
  return task
}
function handleClosed() {
  if (props.resetOnClose) resetFields()
  emit('closed')
}
defineExpose({ innerModel, dirty, submitting, validate, resetFields, submitForm, requestClose })
</script>

<template>
  <el-drawer
    v-bind="$attrs"
    class="x-drawer-form"
    :model-value="modelValue"
    :title="title"
    :size="size"
    :direction="direction"
    :append-to-body="appendToBody"
    :destroy-on-close="destroyOnClose"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    :before-close="() => requestClose('close')"
    @update:model-value="emit('update:modelValue', $event)"
    @open="emit('open')"
    @closed="handleClosed"
  >
    <template v-if="$slots.header" #header><slot name="header" /></template>
    <el-form
      ref="formRef"
      v-bind="formProps"
      class="x-drawer-form__form"
      :model="innerModel"
      :rules="rules"
      :label-width="labelWidth"
      :label-position="labelPosition"
      :disabled="disabled || mode === 'view'"
    >
      <slot :model="innerModel" :mode="mode" :submitting="submitting" :dirty="dirty" />
    </el-form>
    <template #footer
      ><div class="x-drawer-form__footer">
        <slot
          name="footer"
          :model="innerModel"
          :submitting="submitting"
          :dirty="dirty"
          :submit="submitForm"
          :close="requestClose"
          :reset="resetFields"
          ><el-button :disabled="submitting" @click="requestClose('cancel')">{{
            cancelText || business.t('common.cancel')
          }}</el-button
          ><el-button
            v-if="mode !== 'view'"
            type="primary"
            :loading="submitting"
            :disabled="disabled"
            @click="submitForm().catch(() => undefined)"
            >{{ confirmText || business.t('common.save') }}</el-button
          ></slot
        >
      </div></template
    >
  </el-drawer>
</template>
