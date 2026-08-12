<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { cloneValue, isEqualValue } from '@amusite/business-core'
import type { FormDialogBeforeClose, FormDialogCloseContext, FormDialogMode, FormDialogSubmit } from '@amusite/business-core'

type FormModel = Record<string, unknown>
type CloseReason = FormDialogCloseContext['reason']
const props = withDefaults(defineProps<{
  modelValue?: boolean
  model?: FormModel
  title?: string
  mode?: FormDialogMode
  submit?: FormDialogSubmit
  rules?: Record<string, unknown>
  width?: string
  labelWidth?: string
  labelPosition?: 'left' | 'right' | 'top'
  size?: string
  confirmText?: string
  cancelText?: string
  closeOnSuccess?: boolean
  resetOnClose?: boolean
  destroyOnClose?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  appendToBody?: boolean
  allowCloseWhileSubmitting?: boolean
  confirmClose?: boolean | string | ((context: FormDialogCloseContext) => boolean | Promise<boolean>)
  beforeClose?: FormDialogBeforeClose
  disabled?: boolean
  formProps?: Record<string, unknown>
}>(), {
  modelValue: false, model: () => ({}), title: '', mode: 'create', rules: () => ({}), width: '560px',
  labelWidth: '96px', labelPosition: 'right', size: 'small', confirmText: '保存', cancelText: '取消',
  closeOnSuccess: true, resetOnClose: true, destroyOnClose: true, closeOnClickModal: false,
  closeOnPressEscape: true, appendToBody: false, allowCloseWhileSubmitting: false,
  confirmClose: false, disabled: false, formProps: () => ({})
})
const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  'update:model': [model: FormModel]
  'dirty-change': [dirty: boolean]
  'loading-change': [loading: boolean]
  reset: [model: FormModel]
  submit: [model: FormModel, context: { mode: FormDialogMode; model: FormModel }]
  success: [result: unknown, model: FormModel]
  error: [error: unknown, model: FormModel]
  'validation-error': [model: FormModel]
  'guard-error': [error: Error]
  cancel: [context: FormDialogCloseContext]
  open: []
  opened: []
  close: []
  closed: []
}>()
defineSlots<{
  default?: (scope: { model: FormModel; mode: FormDialogMode; submitting: boolean; dirty: boolean; validate: () => Promise<boolean>; reset: () => void }) => unknown
  title?: () => unknown
  footer?: (scope: { model: FormModel; mode: FormDialogMode; submitting: boolean; dirty: boolean; submit: () => Promise<unknown>; close: (reason?: CloseReason) => Promise<boolean>; reset: () => void }) => unknown
}>()
const formRef = ref<{ clearValidate?: () => void; validate?: (callback: (valid: boolean) => void) => void }>()
const innerModel = ref<FormModel>({})
const initialSnapshot = ref<FormModel>({})
const submitting = ref(false)
const dirty = ref(false)
let initialized = false
let syncingModel = false
let currentTask: Promise<unknown> | undefined

function clearValidate() { formRef.value?.clearValidate?.() }
function initializeModel() {
  const model = cloneValue(props.model || {})
  initialized = false
  innerModel.value = model
  initialSnapshot.value = cloneValue(model)
  dirty.value = false
  void nextTick(() => { initialized = true; clearValidate() })
}
watch(() => props.modelValue, (visible) => { if (visible) initializeModel() }, { immediate: true })
watch(() => props.model, (model) => { if (!syncingModel && !isEqualValue(model, innerModel.value)) initializeModel() }, { deep: true })
watch(innerModel, (model) => {
  if (!initialized) return
  const nextDirty = !isEqualValue(model, initialSnapshot.value)
  if (nextDirty !== dirty.value) { dirty.value = nextDirty; emit('dirty-change', nextDirty) }
  syncingModel = true
  emit('update:model', cloneValue(model))
  void nextTick(() => { syncingModel = false })
}, { deep: true })
function getCloseContext(reason: CloseReason): FormDialogCloseContext {
  return { mode: props.mode, model: cloneValue(innerModel.value), dirty: dirty.value, submitting: submitting.value, reason }
}
function restoreSnapshot(emitReset: boolean) {
  const wasDirty = dirty.value
  const model = cloneValue(initialSnapshot.value)
  initialized = false
  innerModel.value = model
  dirty.value = false
  syncingModel = true
  emit('update:model', cloneValue(model))
  if (wasDirty) emit('dirty-change', false)
  void nextTick(() => {
    initialized = true; syncingModel = false; clearValidate()
    if (emitReset) emit('reset', cloneValue(innerModel.value))
  })
}
function resetFields() { restoreSnapshot(true) }
function validate(): Promise<boolean> {
  if (!formRef.value?.validate) return Promise.resolve(true)
  return new Promise((resolve) => formRef.value?.validate?.((valid) => resolve(valid)))
}
async function resolveCloseGuard(reason: CloseReason) {
  if (reason !== 'success' && submitting.value && !props.allowCloseWhileSubmitting) return false
  const context = getCloseContext(reason)
  if (props.beforeClose && (await props.beforeClose(context)) === false) return false
  if (!dirty.value || reason === 'success' || !props.confirmClose) return true
  if (typeof props.confirmClose === 'function') return (await props.confirmClose(context)) !== false
  try {
    await ElMessageBox.confirm(typeof props.confirmClose === 'string' ? props.confirmClose : '内容尚未保存，确认关闭吗？', '提示', { type: 'warning' })
    return true
  } catch { return false }
}
async function requestClose(reason: CloseReason = 'close', done?: () => void) {
  if (!(await resolveCloseGuard(reason))) return false
  if (reason === 'cancel') emit('cancel', getCloseContext(reason))
  if (done) done(); else emit('update:modelValue', false)
  return true
}
function handleClosed() { if (props.resetOnClose) restoreSnapshot(false); emit('closed') }
function submitForm(): Promise<unknown> {
  if (currentTask) return currentTask
  const task = (async () => {
    if (!(await validate())) { emit('validation-error', cloneValue(innerModel.value)); return undefined }
    const model = cloneValue(innerModel.value)
    const context = { mode: props.mode, model }
    emit('submit', model, context)
    if (!props.submit) return model
    submitting.value = true; emit('loading-change', true)
    try {
      const result = await props.submit(model, context)
      initialSnapshot.value = cloneValue(innerModel.value); dirty.value = false; emit('dirty-change', false); emit('success', result, model)
      if (props.closeOnSuccess) await requestClose('success')
      return result
    } catch (error) { emit('error', error, model); throw error }
    finally { submitting.value = false; emit('loading-change', false) }
  })()
  currentTask = task
  void task.then(() => { if (currentTask === task) currentTask = undefined }, () => { if (currentTask === task) currentTask = undefined })
  return task
}
defineExpose({ innerModel, dirty, submitting, validate, resetFields, submitForm, requestClose, clearValidate })
</script>

<template>
  <el-dialog
    v-bind="$attrs"
    class="x-form-dialog"
    :model-value="modelValue"
    :title="title"
    :width="width"
    :append-to-body="appendToBody"
    :destroy-on-close="destroyOnClose"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    :before-close="(done: () => void) => void requestClose('close', done)"
    @update:model-value="emit('update:modelValue', $event)"
    @open="emit('open')"
    @opened="emit('opened')"
    @close="emit('close')"
    @closed="handleClosed"
  >
    <template v-if="$slots.title" #header><slot name="title" /></template>
    <el-form ref="formRef" v-bind="formProps" class="x-form-dialog__form" :model="innerModel" :rules="rules" :label-width="labelWidth" :label-position="labelPosition" :size="size as any" :disabled="disabled || mode === 'view'">
      <slot :model="innerModel" :mode="mode" :submitting="submitting" :dirty="dirty" :validate="validate" :reset="resetFields" />
    </el-form>
    <template #footer>
      <div class="x-form-dialog__footer">
        <slot name="footer" :model="innerModel" :mode="mode" :submitting="submitting" :dirty="dirty" :submit="submitForm" :close="requestClose" :reset="resetFields">
          <el-button v-if="mode === 'view'" :size="size as any" @click="requestClose('cancel')">关闭</el-button>
          <template v-else>
            <el-button :size="size as any" :disabled="submitting" @click="requestClose('cancel')">{{ cancelText }}</el-button>
            <el-button type="primary" :size="size as any" :loading="submitting" :disabled="disabled" @click="submitForm().catch(() => undefined)">{{ confirmText }}</el-button>
          </template>
        </slot>
      </div>
    </template>
  </el-dialog>
</template>
