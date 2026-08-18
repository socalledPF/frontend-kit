import Vue, { type CreateElement, type VNode } from 'vue'
import { scrollTo } from '../utils/scrollTo'
import { getBusinessContext } from '../context'

function getDefaultPagerCount(): number {
  if (typeof document === 'undefined') {
    return 7
  }

  return document.body.clientWidth < 992 ? 5 : 7
}

export default Vue.extend({
  name: 'Pagination',
  props: {
    total: {
      required: true,
      type: Number
    },
    page: {
      type: Number,
      default: 1
    },
    limit: {
      type: Number,
      default: 20
    },
    pageSizes: {
      type: Array,
      default: () => [10, 20, 30, 50]
    },
    pagerCount: {
      type: Number,
      default: getDefaultPagerCount
    },
    layout: {
      type: String,
      default: 'total, sizes, prev, pager, next, jumper'
    },
    background: {
      type: Boolean,
      default: true
    },
    autoScroll: {
      type: Boolean,
      default: true
    },
    hidden: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    currentPage: {
      get(this: any) {
        return this.page
      },
      set(this: any, value: number) {
        this.$emit('update:page', value)
      }
    },
    pageSize: {
      get(this: any) {
        return this.limit
      },
      set(this: any, value: number) {
        this.$emit('update:limit', value)
      }
    }
  },
  mounted(this: any) {
    this.patchAccessibility()
  },
  updated(this: any) {
    this.patchAccessibility()
  },
  methods: {
    patchAccessibility(this: any) {
      this.$nextTick(() => {
        const root = this.$el as HTMLElement | undefined
        root
          ?.querySelector('.btn-prev')
          ?.setAttribute('aria-label', getBusinessContext(this).t('table.previousPage'))
        root
          ?.querySelector('.btn-next')
          ?.setAttribute('aria-label', getBusinessContext(this).t('table.nextPage'))
        root
          ?.querySelector('.el-pagination__sizes input')
          ?.setAttribute('aria-label', getBusinessContext(this).t('table.pageSize'))
        root
          ?.querySelector('.el-pagination__jump input')
          ?.setAttribute('aria-label', getBusinessContext(this).t('table.jumpToPage'))
      })
    },
    handleSizeChange(this: any, value: number) {
      const page = this.currentPage * value > this.total ? 1 : this.currentPage
      if (page !== this.currentPage) this.currentPage = page

      this.$emit('pagination', { page, limit: value })

      if (this.autoScroll) {
        scrollTo(0, 800)
      }
    },
    handleCurrentChange(this: any, value: number) {
      this.$emit('pagination', { page: value, limit: this.pageSize })

      if (this.autoScroll) {
        scrollTo(0, 800)
      }
    }
  },
  render(this: any, h: CreateElement): VNode {
    return h(
      'div',
      {
        class: {
          'x-pagination': true,
          'pagination-container': true,
          hidden: this.hidden
        }
      },
      [
        h('el-pagination', {
          attrs: this.$attrs,
          props: {
            background: this.background,
            currentPage: this.currentPage,
            pageSize: this.pageSize,
            layout: this.layout,
            pageSizes: this.pageSizes,
            pagerCount: this.pagerCount,
            total: this.total
          },
          on: {
            'size-change': this.handleSizeChange,
            'current-change': this.handleCurrentChange
          }
        })
      ]
    )
  }
})
