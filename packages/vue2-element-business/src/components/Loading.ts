import Vue, { type CreateElement, type VNode } from 'vue'
import { getBusinessContext } from '../context'

let bodyLockCount = 0
let originalBodyOverflow = ''

function lockBodyScroll(): void {
  if (typeof document === 'undefined') {
    return
  }

  if (bodyLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  bodyLockCount += 1
}

function unlockBodyScroll(): void {
  if (typeof document === 'undefined' || bodyLockCount === 0) {
    return
  }

  bodyLockCount -= 1

  if (bodyLockCount === 0) {
    document.body.style.overflow = originalBodyOverflow
    originalBodyOverflow = ''
  }
}

function normalizeDuration(value: unknown): number {
  const duration = Number(value)
  return Number.isFinite(duration) && duration > 0 ? duration : 0
}

export default Vue.extend({
  name: 'Loading',
  inheritAttrs: false,
  props: {
    loading: {
      type: Boolean,
      default: false
    },
    text: {
      type: String,
      default: undefined
    },
    fullscreen: {
      type: Boolean,
      default: false
    },
    lock: {
      type: Boolean,
      default: true
    },
    delay: {
      type: Number,
      default: 0
    },
    minDuration: {
      type: Number,
      default: 0
    },
    background: {
      type: String,
      default: 'rgba(255, 255, 255, 0.82)'
    },
    spinnerClass: {
      type: String,
      default: ''
    },
    maskClass: {
      type: String,
      default: ''
    },
    size: {
      type: String,
      default: 'medium',
      validator: (value: string) => ['small', 'medium', 'large'].includes(value)
    },
    zIndex: {
      type: Number,
      default: 2000
    }
  },
  data() {
    return {
      displayedLoading: false,
      shownAt: 0,
      showTimer: null as ReturnType<typeof setTimeout> | null,
      hideTimer: null as ReturnType<typeof setTimeout> | null,
      bodyLocked: false
    }
  },
  watch: {
    loading: {
      immediate: true,
      handler(this: any, value: boolean) {
        this.handleLoadingChange(value)
      }
    },
    fullscreen(this: any) {
      this.syncBodyLock()
    },
    lock(this: any) {
      this.syncBodyLock()
    }
  },
  beforeDestroy(this: any) {
    this.clearShowTimer()
    this.clearHideTimer()

    if (this.bodyLocked) {
      unlockBodyScroll()
      this.bodyLocked = false
    }
  },
  methods: {
    clearShowTimer(this: any) {
      if (this.showTimer !== null) {
        clearTimeout(this.showTimer)
        this.showTimer = null
      }
    },
    clearHideTimer(this: any) {
      if (this.hideTimer !== null) {
        clearTimeout(this.hideTimer)
        this.hideTimer = null
      }
    },
    setDisplayedLoading(this: any, value: boolean) {
      if (this.displayedLoading === value) {
        this.syncBodyLock()
        return
      }

      this.displayedLoading = value

      if (value) {
        this.shownAt = Date.now()
      }

      this.syncBodyLock()
      this.$emit('change', value)
    },
    syncBodyLock(this: any) {
      const shouldLock = this.displayedLoading && this.fullscreen && this.lock

      if (shouldLock && !this.bodyLocked) {
        lockBodyScroll()
        this.bodyLocked = true
      } else if (!shouldLock && this.bodyLocked) {
        unlockBodyScroll()
        this.bodyLocked = false
      }
    },
    show(this: any) {
      this.clearShowTimer()
      this.setDisplayedLoading(true)
    },
    hide(this: any) {
      this.clearHideTimer()

      if (!this.displayedLoading) {
        return
      }

      const remaining = normalizeDuration(this.minDuration) - (Date.now() - this.shownAt)

      if (remaining > 0) {
        this.hideTimer = setTimeout(() => {
          this.hideTimer = null
          this.setDisplayedLoading(false)
        }, remaining)
        return
      }

      this.setDisplayedLoading(false)
    },
    handleLoadingChange(this: any, value: boolean) {
      this.clearShowTimer()

      if (value) {
        this.clearHideTimer()

        if (this.displayedLoading) {
          return
        }

        const delay = normalizeDuration(this.delay)

        if (delay > 0) {
          this.showTimer = setTimeout(() => {
            this.showTimer = null

            if (this.loading) {
              this.show()
            }
          }, delay)
          return
        }

        this.show()
        return
      }

      this.hide()
    },
    renderSpinner(this: any, h: CreateElement): VNode[] | VNode {
      const spinnerSlot = this.$scopedSlots.spinner?.({ loading: this.displayedLoading })

      if (spinnerSlot) {
        return spinnerSlot
      }

      if (this.spinnerClass) {
        return h('i', {
          class: ['x-loading__spinner-icon', this.spinnerClass],
          attrs: { 'aria-hidden': 'true' }
        })
      }

      return h('span', {
        class: 'x-loading__spinner',
        attrs: { 'aria-hidden': 'true' }
      })
    },
    renderTip(this: any, h: CreateElement): VNode[] | VNode | null {
      const tipSlot = this.$scopedSlots.tip?.({ loading: this.displayedLoading })

      if (tipSlot) {
        return tipSlot
      }

      const text = this.text === undefined ? getBusinessContext(this).t('loading.text') : this.text

      if (!text) {
        return null
      }

      return h('span', { class: 'x-loading__text' }, [text])
    }
  },
  render(this: any, h: CreateElement): VNode {
    const defaultSlot = this.$slots.default || []
    const standalone = defaultSlot.length === 0 && !this.fullscreen
    const mask = this.displayedLoading
      ? h(
          'div',
          {
            class: [
              'x-loading__mask',
              `x-loading__mask--${this.size}`,
              {
                'x-loading__mask--fullscreen': this.fullscreen,
                'x-loading__mask--standalone': standalone
              },
              this.maskClass
            ],
            style: {
              backgroundColor: this.background,
              zIndex: this.zIndex
            },
            attrs: {
              role: 'status',
              'aria-live': 'polite',
              'aria-label':
                this.text === undefined ? getBusinessContext(this).t('loading.text') : this.text
            }
          },
          [h('div', { class: 'x-loading__indicator' }, [this.renderSpinner(h), this.renderTip(h)])]
        )
      : undefined

    return h(
      'div',
      {
        class: [
          'x-loading',
          {
            'x-loading--active': this.displayedLoading,
            'x-loading--fullscreen': this.fullscreen,
            'x-loading--standalone': standalone && this.displayedLoading
          }
        ],
        attrs: {
          ...this.$attrs,
          'aria-busy': String(this.displayedLoading)
        }
      },
      [
        ...defaultSlot,
        h(
          'transition',
          {
            props: {
              name: 'x-loading-fade',
              appear: true
            }
          },
          mask ? [mask] : []
        )
      ]
    )
  }
})
