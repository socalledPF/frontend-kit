import Vue, { type CreateElement, type VNode } from 'vue'
import { downloadBlob } from '@amusite/utils'
import type { ExportFile, ExportResult } from '../types'
import AsyncButton from './AsyncButton'

function isExportFile(result: ExportResult): result is ExportFile {
  return Boolean(
    result &&
      typeof result === 'object' &&
      !(typeof Blob !== 'undefined' && result instanceof Blob) &&
      !(result instanceof ArrayBuffer) &&
      Object.prototype.hasOwnProperty.call(result, 'data')
  )
}

export default Vue.extend({
  name: 'ExportButton',
  inheritAttrs: false,
  props: {
    request: {
      type: Function,
      required: true
    },
    fileName: {
      type: [String, Function],
      default: 'export.xlsx'
    },
    transformResult: {
      type: Function,
      default: undefined
    },
    download: {
      type: Function,
      default: undefined
    },
    autoDownload: {
      type: Boolean,
      default: true
    },
    beforeExport: {
      type: Function,
      default: undefined
    },
    confirm: {
      type: [Boolean, String, Function],
      default: false
    },
    confirmOptions: {
      type: Object,
      default: () => ({})
    },
    loading: {
      type: Boolean,
      default: undefined
    },
    disabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      default: 'primary'
    },
    size: {
      type: String,
      default: 'small'
    },
    icon: {
      type: String,
      default: 'el-icon-download'
    },
    plain: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    resolveFile(this: any, result: ExportResult, args: unknown[]): ExportFile {
      const normalized = isExportFile(result) ? result : { data: result }
      const configuredName =
        typeof this.fileName === 'function' ? this.fileName(normalized, ...args) : this.fileName

      return {
        ...normalized,
        fileName: normalized.fileName || configuredName || 'export.xlsx'
      }
    },
    async runExport(this: any, ...args: unknown[]): Promise<ExportFile> {
      const rawResult = await this.request(...args)
      const result = this.transformResult
        ? await this.transformResult(rawResult, ...args)
        : rawResult
      const file = this.resolveFile(result as ExportResult, args)

      if (this.autoDownload) {
        if (this.download) {
          await this.download(file, ...args)
        } else {
          downloadBlob(file.data, file.fileName || 'export.xlsx', { type: file.type })
        }
        this.$emit('download', file, ...args)
      }

      return file
    },
    execute(this: any, ...args: unknown[]): Promise<unknown> {
      return this.$refs.button.execute(...args)
    }
  },
  render(this: any, h: CreateElement): VNode {
    const content = this.$scopedSlots.default ? undefined : this.$slots.default || ['导出']

    return h(
      AsyncButton,
      {
        ref: 'button',
        class: 'x-export-button',
        attrs: this.$attrs,
        props: {
          action: this.runExport,
          beforeAction: this.beforeExport,
          confirm: this.confirm,
          confirmOptions: this.confirmOptions,
          loading: this.loading,
          disabled: this.disabled,
          type: this.type,
          size: this.size,
          icon: this.icon,
          plain: this.plain
        },
        on: {
          click: (event: MouseEvent) => this.$emit('click', event),
          'loading-change': (loading: boolean) => this.$emit('loading-change', loading),
          success: (result: ExportFile, ...args: unknown[]) =>
            this.$emit('success', result, ...args),
          error: (error: unknown, ...args: unknown[]) => this.$emit('error', error, ...args),
          cancel: (...args: unknown[]) => this.$emit('cancel', ...args)
        },
        scopedSlots: this.$scopedSlots.default
          ? {
              default: this.$scopedSlots.default
            }
          : undefined
      },
      content
    )
  }
})
