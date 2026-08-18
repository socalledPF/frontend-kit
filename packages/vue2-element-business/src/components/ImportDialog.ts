import Vue, { type CreateElement, type VNode } from 'vue'
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
} from '../types'
import { getBusinessContext } from '../context'

const BYTES_PER_MEGABYTE = 1024 * 1024

interface ElementUploadFile {
  name?: string
  raw?: File
}

export default Vue.extend({
  name: 'ImportDialog',
  inheritAttrs: false,
  props: {
    value: {
      type: Boolean,
      default: false
    },
    request: {
      type: Function,
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    width: {
      type: String,
      default: '520px'
    },
    accept: {
      type: String,
      default: '.xlsx,.xls'
    },
    maxSizeMb: {
      type: Number,
      default: 10
    },
    fieldName: {
      type: String,
      default: 'file'
    },
    data: {
      type: [Object, Function],
      default: () => ({})
    },
    beforeImport: {
      type: Function,
      default: undefined
    },
    updateExisting: {
      type: Boolean,
      default: false
    },
    showUpdateExisting: {
      type: Boolean,
      default: false
    },
    updateExistingText: {
      type: String,
      default: ''
    },
    templateUrl: {
      type: String,
      default: ''
    },
    templateDownload: {
      type: Function,
      default: undefined
    },
    confirmText: {
      type: String,
      default: ''
    },
    cancelText: {
      type: String,
      default: ''
    },
    closeOnSuccess: {
      type: Boolean,
      default: false
    },
    resetOnClose: {
      type: Boolean,
      default: true
    },
    appendToBody: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      selectedFile: undefined as File | undefined,
      status: 'ready' as 'ready' | 'uploading' | 'success' | 'error',
      percentage: 0,
      result: undefined as ImportResult | undefined,
      errorMessage: '',
      validationMessage: '',
      innerUpdateExisting: false,
      controller: undefined as AbortController | undefined,
      runId: 0,
      currentTask: undefined as Promise<ImportResult | undefined> | undefined,
      templateLoading: false,
      destroyed: false
    }
  },
  computed: {
    importing(this: any): boolean {
      return this.status === 'uploading'
    },
    resultType(this: any): string {
      return Number(this.result?.failureCount || 0) > 0 ? 'warning' : 'success'
    }
  },
  watch: {
    value: {
      immediate: true,
      handler(this: any, visible: boolean) {
        if (visible) {
          this.innerUpdateExisting = this.updateExisting
        } else if (this.importing) {
          this.abort()
        }
      }
    },
    updateExisting(this: any, value: boolean) {
      this.innerUpdateExisting = value
    }
  },
  beforeDestroy(this: any) {
    this.destroyed = true
    this.abort()
  },
  methods: {
    emitValidationError(
      this: any,
      code: ImportValidationErrorCode,
      message: string,
      file?: File,
      error?: unknown
    ) {
      const detail: ImportValidationError = { code, message, file, error }
      this.validationMessage = message
      this.$emit('validation-error', detail)
      return false
    },
    validateFile(this: any, file: File): boolean {
      if (!matchesFileAccept(file, this.accept)) {
        return this.emitValidationError(
          'type',
          getBusinessContext(this).t('import.type', { accept: this.accept }),
          file
        )
      }

      if (this.maxSizeMb > 0 && file.size > this.maxSizeMb * BYTES_PER_MEGABYTE) {
        return this.emitValidationError(
          'size',
          getBusinessContext(this).t('import.size', { size: this.maxSizeMb }),
          file
        )
      }

      return true
    },
    handleFileChange(this: any, uploadFile: ElementUploadFile) {
      const file = uploadFile.raw
      if (!file || this.disabled || this.importing || !this.validateFile(file)) {
        this.$refs.upload?.clearFiles?.()
        return
      }

      this.selectedFile = file
      this.status = 'ready'
      this.percentage = 0
      this.result = undefined
      this.errorMessage = ''
      this.validationMessage = ''
      this.$refs.upload?.clearFiles?.()
      this.$emit('select', file)
    },
    resolveData(this: any, file: File): Record<string, unknown> {
      const data = this.data as ImportData
      return typeof data === 'function'
        ? { ...(data(file, this.innerUpdateExisting) || {}) }
        : { ...(data || {}) }
    },
    submit(this: any): Promise<ImportResult | undefined> {
      if (this.currentTask) {
        return this.currentTask
      }

      const task = (async () => {
        const file = this.selectedFile
        if (!file) {
          this.emitValidationError('config', getBusinessContext(this).t('import.selectFirst'))
          return undefined
        }

        this.runId += 1
        const runId = this.runId

        const allowed =
          !this.beforeImport || (await this.beforeImport(file, this.innerUpdateExisting)) !== false

        if (runId !== this.runId || this.destroyed) {
          return undefined
        }

        if (!allowed) {
          this.emitValidationError(
            'before-import',
            getBusinessContext(this).t('import.beforeRejected'),
            file
          )
          return undefined
        }

        this.controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
        this.status = 'uploading'
        this.percentage = 0
        this.errorMessage = ''
        this.result = undefined
        this.$emit('loading-change', true)

        try {
          const request = this.request as ImportRequest
          const result = await request({
            file,
            fieldName: this.fieldName,
            data: this.resolveData(file),
            updateExisting: this.innerUpdateExisting,
            signal: this.controller?.signal,
            onProgress: (percentage) => {
              if (runId !== this.runId || this.destroyed) {
                return
              }
              this.percentage = clampPercentage(percentage)
              this.$emit('progress', this.percentage, file)
            }
          })

          if (runId !== this.runId || this.destroyed) {
            return undefined
          }

          this.percentage = 100
          this.$emit('progress', 100, file)
          this.status = 'success'
          this.result = result || {}
          this.$emit('success', this.result, file)

          if (this.closeOnSuccess) {
            this.$emit('input', false)
          }

          return this.result
        } catch (error) {
          if (runId !== this.runId || this.destroyed) {
            return undefined
          }

          this.status = 'error'
          this.errorMessage = getErrorMessage(error, getBusinessContext(this).t('import.failed'))
          getBusinessContext(this).notifyError?.(error, {
            source: 'ImportDialog',
            action: 'import',
            metadata: { name: file.name }
          })
          this.$emit('error', error, file)
          throw error
        } finally {
          if (runId === this.runId && !this.destroyed) {
            this.controller = undefined
            this.$emit('loading-change', false)
          }
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
    abort(this: any) {
      if (!this.importing && !this.currentTask) {
        return
      }

      const file = this.selectedFile
      const wasImporting = this.importing
      this.runId += 1
      this.controller?.abort()
      this.controller = undefined
      this.currentTask = undefined
      this.status = 'ready'
      this.percentage = 0
      if (wasImporting) {
        this.$emit('loading-change', false)
      }
      this.$emit('cancel', file)
    },
    clear(this: any) {
      this.abort()
      this.selectedFile = undefined
      this.status = 'ready'
      this.percentage = 0
      this.result = undefined
      this.errorMessage = ''
      this.validationMessage = ''
      this.$refs.upload?.clearFiles?.()
      this.$emit('clear')
    },
    handleUpdateExisting(this: any, value: boolean) {
      this.innerUpdateExisting = value
      this.$emit('update:updateExisting', value)
    },
    handleBeforeClose(this: any, done: () => void) {
      if (this.importing) {
        return
      }
      done()
    },
    handleClosed(this: any) {
      if (this.resetOnClose) {
        this.clear()
      }
      this.$emit('closed')
    },
    handleCancel(this: any) {
      if (!this.importing) {
        this.$emit('input', false)
      }
    },
    handleSubmit(this: any) {
      void this.submit().catch(() => undefined)
    },
    async handleTemplateDownload(this: any) {
      if (!this.templateDownload || this.templateLoading) {
        return
      }

      this.templateLoading = true
      try {
        await this.templateDownload()
        this.$emit('template-success')
      } catch (error) {
        getBusinessContext(this).notifyError?.(error, {
          source: 'ImportDialog',
          action: 'download-template'
        })
        this.$emit('template-error', error)
      } finally {
        this.templateLoading = false
      }
    },
    renderResult(this: any, h: CreateElement): VNode | null {
      if (!this.result) {
        return null
      }

      const result = this.result as ImportResult
      const errors = result.errors || []
      const summary = [
        result.successCount !== undefined
          ? getBusinessContext(this).t('import.successCount', { count: result.successCount })
          : '',
        result.failureCount !== undefined
          ? getBusinessContext(this).t('import.failureCount', { count: result.failureCount })
          : ''
      ]
        .filter(Boolean)
        .join('，')

      return h('div', { class: 'x-import-dialog__result' }, [
        h('el-alert', {
          props: {
            title: result.message || summary || getBusinessContext(this).t('import.completed'),
            type: this.resultType,
            closable: false,
            showIcon: true
          }
        }),
        errors.length > 0
          ? h(
              'ul',
              { class: 'x-import-dialog__error-list' },
              errors.map((error, index) =>
                h('li', { key: `${error.row || 'row'}-${index}` }, [
                  error.row
                    ? getBusinessContext(this).t('import.rowError', { row: error.row })
                    : '',
                  error.message
                ])
              )
            )
          : null
      ])
    }
  },
  render(this: any, h: CreateElement): VNode {
    const templateSlot = this.$slots.template
    const tipSlot = this.$slots.tip

    return h(
      'el-dialog',
      {
        class: 'x-import-dialog',
        attrs: this.$attrs,
        props: {
          visible: this.value,
          title: this.title || getBusinessContext(this).t('import.title'),
          width: this.width,
          appendToBody: this.appendToBody,
          closeOnClickModal: false,
          closeOnPressEscape: !this.importing,
          beforeClose: this.handleBeforeClose
        },
        on: {
          'update:visible': (visible: boolean) => this.$emit('input', visible),
          open: () => this.$emit('open'),
          closed: this.handleClosed
        }
      },
      [
        this.templateDownload || this.templateUrl || templateSlot
          ? h('div', { class: 'x-import-dialog__template' }, [
              h('span', [getBusinessContext(this).t('import.templateHint')]),
              templateSlot ||
                (this.templateDownload
                  ? h(
                      'el-button',
                      {
                        props: { type: 'text', loading: this.templateLoading },
                        on: { click: this.handleTemplateDownload }
                      },
                      [getBusinessContext(this).t('import.downloadTemplate')]
                    )
                  : h(
                      'a',
                      {
                        class: 'x-import-dialog__template-link',
                        attrs: { href: this.templateUrl, download: '' }
                      },
                      [getBusinessContext(this).t('import.downloadTemplate')]
                    ))
            ])
          : null,
        h(
          'el-upload',
          {
            ref: 'upload',
            class: 'x-import-dialog__upload',
            props: {
              drag: true,
              action: '#',
              accept: this.accept,
              autoUpload: false,
              showFileList: false,
              disabled: this.disabled || this.importing,
              httpRequest: () => Promise.resolve()
            },
            on: { change: this.handleFileChange }
          },
          [
            h('i', { class: 'el-icon-upload x-import-dialog__upload-icon' }),
            h('div', { class: 'el-upload__text' }, [
              getBusinessContext(this).t('upload.dropText'),
              h('em', [getBusinessContext(this).t('upload.clickText')])
            ])
          ]
        ),
        tipSlot
          ? h('div', { class: 'x-import-dialog__tip' }, tipSlot)
          : h('div', { class: 'x-import-dialog__tip' }, [
              getBusinessContext(this).t('import.supportTip', {
                accept: this.accept,
                size: this.maxSizeMb
              })
            ]),
        this.selectedFile
          ? h('div', { class: 'x-import-dialog__file' }, [
              h('i', { class: 'el-icon-document x-import-dialog__file-icon' }),
              h('div', { class: 'x-import-dialog__file-main' }, [
                h('div', { class: 'x-import-dialog__file-name' }, [this.selectedFile.name]),
                h('div', { class: 'x-import-dialog__file-size' }, [
                  formatFileSize(this.selectedFile.size)
                ]),
                this.importing
                  ? h('el-progress', {
                      props: { percentage: this.percentage, strokeWidth: 4 }
                    })
                  : null
              ]),
              h('el-button', {
                class: 'x-import-dialog__remove',
                props: {
                  type: 'text',
                  icon: 'el-icon-delete',
                  disabled: this.importing
                },
                attrs: {
                  title: getBusinessContext(this).t('common.remove'),
                  'aria-label': getBusinessContext(this).t('common.remove')
                },
                on: { click: this.clear }
              })
            ])
          : null,
        this.showUpdateExisting
          ? h(
              'el-checkbox',
              {
                class: 'x-import-dialog__update-existing',
                props: { value: this.innerUpdateExisting, disabled: this.importing },
                on: { input: this.handleUpdateExisting }
              },
              [this.updateExistingText || getBusinessContext(this).t('import.updateExisting')]
            )
          : null,
        this.validationMessage
          ? h('div', { class: 'x-import-dialog__validation-error' }, [this.validationMessage])
          : null,
        this.errorMessage
          ? h('el-alert', {
              class: 'x-import-dialog__request-error',
              props: { title: this.errorMessage, type: 'error', closable: false, showIcon: true }
            })
          : null,
        this.renderResult(h),
        h('div', { slot: 'footer', class: 'x-import-dialog__footer' }, [
          h(
            'el-button',
            {
              props: { size: 'small', disabled: this.importing },
              on: { click: this.handleCancel }
            },
            [this.cancelText || getBusinessContext(this).t('common.cancel')]
          ),
          h(
            'el-button',
            {
              props: {
                type: 'primary',
                size: 'small',
                loading: this.importing,
                disabled: this.disabled || !this.selectedFile
              },
              on: { click: this.handleSubmit }
            },
            [
              this.status === 'error'
                ? getBusinessContext(this).t('common.retry')
                : this.confirmText || getBusinessContext(this).t('import.start')
            ]
          )
        ])
      ]
    )
  }
})
