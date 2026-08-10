import Vue, { type CreateElement, type VNode } from 'vue'
import type { AsyncButtonConfirm } from '../types'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return typeof error === 'string' ? error : '操作失败'
}

export default Vue.extend({
  name: 'AsyncButton',
  inheritAttrs: false,
  props: {
    action: {
      type: Function,
      required: true
    },
    confirm: {
      type: [Boolean, String, Function],
      default: false
    },
    confirmOptions: {
      type: Object,
      default: () => ({})
    },
    beforeAction: {
      type: Function,
      default: undefined
    },
    loading: {
      type: Boolean,
      default: undefined
    },
    lock: {
      type: Boolean,
      default: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      default: 'default'
    },
    size: {
      type: String,
      default: 'small'
    },
    icon: {
      type: String,
      default: ''
    },
    plain: {
      type: Boolean,
      default: false
    },
    round: {
      type: Boolean,
      default: false
    },
    circle: {
      type: Boolean,
      default: false
    },
    nativeType: {
      type: String,
      default: 'button'
    }
  },
  data() {
    return {
      innerLoading: false,
      runningCount: 0,
      currentTask: undefined as Promise<unknown> | undefined
    }
  },
  computed: {
    displayedLoading(this: any): boolean {
      return typeof this.loading === 'boolean' ? this.loading : this.innerLoading
    }
  },
  methods: {
    setInnerLoading(this: any, value: boolean) {
      if (this.innerLoading === value) {
        return
      }

      this.innerLoading = value
      this.$emit('loading-change', value)
    },
    async resolveConfirmation(this: any, args: unknown[]): Promise<boolean> {
      const confirmation = this.confirm as AsyncButtonConfirm

      if (!confirmation) {
        return true
      }

      if (typeof confirmation === 'function') {
        return (await confirmation(...args)) !== false
      }

      const message = typeof confirmation === 'string' ? confirmation : '确认执行此操作吗？'
      const confirmMethod = this.$confirm

      if (typeof confirmMethod !== 'function') {
        throw new Error('AsyncButton 使用确认文案时需要先注册 Element-UI MessageBox')
      }

      try {
        await confirmMethod(message, this.confirmOptions.title || '提示', this.confirmOptions)
        return true
      } catch {
        return false
      }
    },
    execute(this: any, ...args: unknown[]): Promise<unknown> {
      if (this.lock && this.currentTask) {
        return this.currentTask
      }

      if (this.lock && this.displayedLoading) {
        return Promise.resolve(undefined)
      }

      const task = (async () => {
        try {
          const confirmed = await this.resolveConfirmation(args)

          if (!confirmed) {
            this.$emit('cancel', ...args)
            return undefined
          }

          if (this.beforeAction && (await this.beforeAction(...args)) === false) {
            this.$emit('cancel', ...args)
            return undefined
          }

          this.runningCount += 1
          this.setInnerLoading(true)
          const result = await this.action(...args)
          this.$emit('success', result, ...args)
          return result
        } catch (error) {
          this.$emit('error', error, ...args)
          throw error
        } finally {
          if (this.runningCount > 0) {
            this.runningCount -= 1
            this.setInnerLoading(this.runningCount > 0)
          }
        }
      })()

      this.currentTask = task
      const clearCurrentTask = () => {
        if (this.currentTask === task) {
          this.currentTask = undefined
        }
      }
      void task.then(clearCurrentTask, clearCurrentTask)
      return task
    },
    handleClick(this: any, event: MouseEvent) {
      this.$emit('click', event)
      void this.execute(event).catch(() => undefined)
    },
    getErrorMessage
  },
  render(this: any, h: CreateElement): VNode {
    const content = this.$scopedSlots.default?.({
      loading: this.displayedLoading,
      execute: this.execute
    }) ||
      this.$slots.default || ['提交']

    return h(
      'el-button',
      {
        attrs: {
          ...this.$attrs
        },
        props: {
          type: this.type,
          size: this.size,
          icon: this.icon,
          plain: this.plain,
          round: this.round,
          circle: this.circle,
          nativeType: this.nativeType,
          loading: this.displayedLoading,
          disabled: this.disabled || (this.lock && this.displayedLoading)
        },
        on: {
          click: this.handleClick
        }
      },
      content
    )
  }
})
