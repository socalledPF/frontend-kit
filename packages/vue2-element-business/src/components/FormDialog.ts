import Vue, { type CreateElement, type VNode } from 'vue'
import type {
  FormDialogBeforeClose,
  FormDialogCloseContext,
  FormDialogMode,
  FormDialogSubmit
} from '../types'

type FormModel = Record<string, unknown>
type CloseReason = FormDialogCloseContext['reason']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function cloneValue<T>(value: T): T {
  if (value instanceof Date) {
    return new Date(value.getTime()) as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T
  }

  if (isPlainObject(value)) {
    return Object.keys(value).reduce<Record<string, unknown>>((result, key) => {
      result[key] = cloneValue(value[key])
      return result
    }, {}) as T
  }

  return value
}

function isEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime()
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => isEqual(item, right[index]))
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)

    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) => Object.prototype.hasOwnProperty.call(right, key) && isEqual(left[key], right[key])
      )
    )
  }

  return false
}

export default Vue.extend({
  name: 'FormDialog',
  inheritAttrs: false,
  props: {
    value: {
      type: Boolean,
      default: false
    },
    model: {
      type: Object,
      default: () => ({})
    },
    title: {
      type: String,
      default: ''
    },
    mode: {
      type: String,
      default: 'create',
      validator: (value: string) => ['create', 'edit', 'view'].includes(value)
    },
    submit: {
      type: Function,
      default: undefined
    },
    rules: {
      type: Object,
      default: () => ({})
    },
    width: {
      type: String,
      default: '560px'
    },
    labelWidth: {
      type: String,
      default: '96px'
    },
    labelPosition: {
      type: String,
      default: 'right'
    },
    size: {
      type: String,
      default: 'small'
    },
    confirmText: {
      type: String,
      default: '保存'
    },
    cancelText: {
      type: String,
      default: '取消'
    },
    closeOnSuccess: {
      type: Boolean,
      default: true
    },
    resetOnClose: {
      type: Boolean,
      default: true
    },
    destroyOnClose: {
      type: Boolean,
      default: true
    },
    closeOnClickModal: {
      type: Boolean,
      default: false
    },
    closeOnPressEscape: {
      type: Boolean,
      default: true
    },
    appendToBody: {
      type: Boolean,
      default: false
    },
    allowCloseWhileSubmitting: {
      type: Boolean,
      default: false
    },
    confirmClose: {
      type: [Boolean, String, Function],
      default: false
    },
    beforeClose: {
      type: Function,
      default: undefined
    },
    disabled: {
      type: Boolean,
      default: false
    },
    formProps: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      innerModel: {} as FormModel,
      initialSnapshot: {} as FormModel,
      submitting: false,
      dirty: false,
      initialized: false,
      currentTask: undefined as Promise<unknown> | undefined,
      syncingModel: false
    }
  },
  watch: {
    value: {
      immediate: true,
      handler(this: any, visible: boolean) {
        if (visible) {
          this.initializeModel()
        }
      }
    },
    model: {
      deep: true,
      handler(this: any, model: FormModel) {
        if (this.syncingModel || isEqual(model, this.innerModel)) {
          return
        }

        this.initializeModel()
      }
    },
    innerModel: {
      deep: true,
      handler(this: any, model: FormModel) {
        if (!this.initialized) {
          return
        }

        const dirty = !isEqual(model, this.initialSnapshot)
        if (dirty !== this.dirty) {
          this.dirty = dirty
          this.$emit('dirty-change', dirty)
        }

        this.syncingModel = true
        this.$emit('update:model', cloneValue(model))
        this.$nextTick(() => {
          this.syncingModel = false
        })
      }
    }
  },
  methods: {
    initializeModel(this: any) {
      const model = cloneValue(this.model || {})
      this.initialized = false
      this.innerModel = model
      this.initialSnapshot = cloneValue(model)
      this.dirty = false
      this.$nextTick(() => {
        this.initialized = true
        this.clearValidate()
      })
    },
    getCloseContext(this: any, reason: CloseReason): FormDialogCloseContext {
      return {
        mode: this.mode as FormDialogMode,
        model: cloneValue(this.innerModel),
        dirty: this.dirty,
        submitting: this.submitting,
        reason
      }
    },
    clearValidate(this: any) {
      this.$refs.form?.clearValidate?.()
    },
    restoreSnapshot(this: any, emitReset: boolean) {
      const wasDirty = this.dirty
      const model = cloneValue(this.initialSnapshot)
      this.initialized = false
      this.innerModel = model
      this.dirty = false
      this.syncingModel = true
      this.$emit('update:model', cloneValue(model))
      if (wasDirty) {
        this.$emit('dirty-change', false)
      }
      this.$nextTick(() => {
        this.initialized = true
        this.syncingModel = false
        this.clearValidate()
        if (emitReset) {
          this.$emit('reset', cloneValue(this.innerModel))
        }
      })
    },
    resetFields(this: any) {
      this.restoreSnapshot(true)
    },
    validate(this: any): Promise<boolean> {
      const form = this.$refs.form

      if (!form?.validate) {
        return Promise.resolve(true)
      }

      return new Promise((resolve) => {
        form.validate((valid: boolean) => resolve(valid))
      })
    },
    async resolveCloseGuard(this: any, reason: CloseReason): Promise<boolean> {
      if (reason !== 'success' && this.submitting && !this.allowCloseWhileSubmitting) {
        return false
      }

      const context = this.getCloseContext(reason)
      const beforeClose = this.beforeClose as FormDialogBeforeClose | undefined
      if (beforeClose && (await beforeClose(context)) === false) {
        return false
      }

      if (!this.dirty || reason === 'success' || !this.confirmClose) {
        return true
      }

      if (typeof this.confirmClose === 'function') {
        return (await this.confirmClose(context)) !== false
      }

      const confirm = this.$confirm
      if (typeof confirm !== 'function') {
        this.$emit('guard-error', new Error('confirmClose 需要先注册 Element-UI MessageBox'))
        return false
      }

      const message =
        typeof this.confirmClose === 'string' ? this.confirmClose : '内容尚未保存，确认关闭吗？'

      try {
        await confirm(message, '提示', { type: 'warning' })
        return true
      } catch {
        return false
      }
    },
    async requestClose(this: any, reason: CloseReason = 'close', done?: () => void) {
      if (!(await this.resolveCloseGuard(reason))) {
        return false
      }

      if (reason === 'cancel') {
        this.$emit('cancel', this.getCloseContext(reason))
      }

      if (done) {
        done()
      } else {
        this.$emit('input', false)
      }

      return true
    },
    handleBeforeClose(this: any, done: () => void) {
      void this.requestClose('close', done)
    },
    handleVisibleUpdate(this: any, visible: boolean) {
      this.$emit('input', visible)
    },
    handleClosed(this: any) {
      if (this.resetOnClose) {
        this.restoreSnapshot(false)
      }
      this.$emit('closed')
    },
    submitForm(this: any): Promise<unknown> {
      if (this.currentTask) {
        return this.currentTask
      }

      const task = (async () => {
        const valid = await this.validate()
        if (!valid) {
          this.$emit('validation-error', cloneValue(this.innerModel))
          return undefined
        }

        const model = cloneValue(this.innerModel)
        const context = {
          mode: this.mode as FormDialogMode,
          model
        }
        this.$emit('submit', model, context)

        const submit = this.submit as FormDialogSubmit | undefined
        if (!submit) {
          return model
        }

        this.submitting = true
        this.$emit('loading-change', true)

        try {
          const result = await submit(model, context)
          this.initialSnapshot = cloneValue(this.innerModel)
          this.dirty = false
          this.$emit('dirty-change', false)
          this.$emit('success', result, model)

          if (this.closeOnSuccess) {
            await this.requestClose('success')
          }

          return result
        } catch (error) {
          this.$emit('error', error, model)
          throw error
        } finally {
          this.submitting = false
          this.$emit('loading-change', false)
        }
      })()

      this.currentTask = task
      const clearTask = () => {
        if (this.currentTask === task) {
          this.currentTask = undefined
        }
      }
      void task.then(clearTask, clearTask)
      return task
    },
    handleSubmitClick(this: any) {
      void this.submitForm().catch(() => undefined)
    },
    handleCancelClick(this: any) {
      void this.requestClose('cancel')
    },
    renderFooter(this: any, h: CreateElement): VNode[] {
      const scope = {
        model: this.innerModel,
        mode: this.mode,
        submitting: this.submitting,
        dirty: this.dirty,
        submit: this.submitForm,
        close: this.requestClose,
        reset: this.resetFields
      }
      const customFooter = this.$scopedSlots.footer?.(scope)
      if (customFooter) {
        return customFooter
      }

      if (this.mode === 'view') {
        return [
          h('el-button', { props: { size: this.size }, on: { click: this.handleCancelClick } }, [
            '关闭'
          ])
        ]
      }

      return [
        h(
          'el-button',
          {
            props: { size: this.size, disabled: this.submitting },
            on: { click: this.handleCancelClick }
          },
          [this.cancelText]
        ),
        h(
          'el-button',
          {
            props: {
              type: 'primary',
              size: this.size,
              loading: this.submitting,
              disabled: this.disabled
            },
            on: { click: this.handleSubmitClick }
          },
          [this.confirmText]
        )
      ]
    }
  },
  render(this: any, h: CreateElement): VNode {
    const slotScope = {
      model: this.innerModel,
      mode: this.mode,
      submitting: this.submitting,
      dirty: this.dirty,
      validate: this.validate,
      reset: this.resetFields
    }
    const formContent = this.$scopedSlots.default?.(slotScope) || this.$slots.default
    const titleSlot = this.$slots.title

    return h(
      'el-dialog',
      {
        class: 'x-form-dialog',
        attrs: this.$attrs,
        props: {
          visible: this.value,
          title: this.title,
          width: this.width,
          appendToBody: this.appendToBody,
          destroyOnClose: this.destroyOnClose,
          closeOnClickModal: this.closeOnClickModal,
          closeOnPressEscape: this.closeOnPressEscape,
          beforeClose: this.handleBeforeClose
        },
        on: {
          'update:visible': this.handleVisibleUpdate,
          open: () => this.$emit('open'),
          opened: () => this.$emit('opened'),
          close: () => this.$emit('close'),
          closed: this.handleClosed
        }
      },
      [
        titleSlot ? h('template', { slot: 'title' }, titleSlot) : null,
        h(
          'el-form',
          {
            ref: 'form',
            class: 'x-form-dialog__form',
            props: {
              ...this.formProps,
              model: this.innerModel,
              rules: this.rules,
              labelWidth: this.labelWidth,
              labelPosition: this.labelPosition,
              size: this.size,
              disabled: this.disabled || this.mode === 'view'
            }
          },
          formContent
        ),
        h('div', { slot: 'footer', class: 'x-form-dialog__footer' }, this.renderFooter(h))
      ]
    )
  }
})
