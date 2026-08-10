import Vue, { type CreateElement, type VNode } from 'vue'
import type { ProTableColumn } from '../types'
import Loading from './Loading'
import Pagination from './Pagination'

const RESERVED_COLUMN_FIELDS = ['visible', 'slotName', 'headerSlotName', 'columnSetting', 'key']

function compactObject<T extends Record<string, unknown>>(value: T): T {
  Object.keys(value).forEach((field) => {
    if (value[field] === undefined) {
      delete value[field]
    }
  })

  return value
}

export default Vue.extend({
  name: 'ProTable',
  inheritAttrs: false,
  props: {
    data: {
      type: Array,
      default: () => []
    },
    columns: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    loadingProps: {
      type: Object,
      default: () => ({})
    },
    size: {
      type: String,
      default: undefined
    },
    page: {
      type: Number,
      default: 1
    },
    limit: {
      type: Number,
      default: 20
    },
    total: {
      type: Number,
      default: 0
    },
    showPagination: {
      type: Boolean,
      default: true
    },
    paginationHiddenWhenNoData: {
      type: Boolean,
      default: true
    },
    paginationProps: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    visibleColumns(this: any) {
      return this.columns.filter((column: ProTableColumn) => column.visible !== false)
    },
    shouldShowPagination(this: any) {
      if (!this.showPagination) {
        return false
      }

      if (this.paginationHiddenWhenNoData) {
        return this.total > 0
      }

      return true
    }
  },
  methods: {
    getColumnKey(column: ProTableColumn, index: number) {
      const identity =
        column.key ||
        column.prop ||
        column.type ||
        column.slotName ||
        column.headerSlotName ||
        'column'

      return `${identity}-${index}`
    },
    hasColumnSlot(this: any, column: ProTableColumn) {
      return Boolean(column.slotName && this.$scopedSlots[column.slotName])
    },
    hasColumnHeaderSlot(this: any, column: ProTableColumn) {
      return Boolean(column.headerSlotName && this.$scopedSlots[column.headerSlotName])
    },
    getHeaderSlotScope(scope: any, column: ProTableColumn) {
      return {
        column: scope.column,
        $index: scope.$index,
        columnConfig: column
      }
    },
    getSlotScope(scope: any, column: ProTableColumn) {
      return {
        row: scope.row,
        column: scope.column,
        $index: scope.$index,
        columnConfig: column
      }
    },
    getColumnAttrs(this: any, column: ProTableColumn) {
      const attrs = { ...column }

      RESERVED_COLUMN_FIELDS.forEach((field) => {
        delete attrs[field]
      })

      if (attrs.showOverflowTooltip === undefined) {
        attrs.showOverflowTooltip = this.resolveShowOverflowTooltip(column)
      }

      return compactObject(attrs)
    },
    resolveShowOverflowTooltip(column: ProTableColumn) {
      if (column.showOverflowTooltip !== undefined) {
        return column.showOverflowTooltip
      }

      if (column.type) {
        return false
      }

      return true
    },
    handleUpdatePage(this: any, value: number) {
      this.$emit('update:page', value)
    },
    handleUpdateLimit(this: any, value: number) {
      this.$emit('update:limit', value)
    },
    handlePagination(this: any, payload: unknown) {
      this.$emit('pagination', payload)
    },
    renderColumn(this: any, h: CreateElement, column: ProTableColumn, index: number) {
      const hasHeaderSlot = this.hasColumnHeaderSlot(column)
      const hasBodySlot = this.hasColumnSlot(column)
      const scopedSlots: Record<string, (scope: any) => VNode[] | VNode | undefined> = {}

      const headerSlotName = column.headerSlotName
      const bodySlotName = column.slotName

      if (hasHeaderSlot && headerSlotName) {
        scopedSlots.header = (scope: any) =>
          this.$scopedSlots[headerSlotName](this.getHeaderSlotScope(scope, column))
      }

      if (hasBodySlot && bodySlotName) {
        scopedSlots.default = (scope: any) =>
          this.$scopedSlots[bodySlotName](this.getSlotScope(scope, column))
      }

      return h('el-table-column', {
        key: this.getColumnKey(column, index),
        props: this.getColumnAttrs(column),
        scopedSlots
      })
    }
  },
  render(this: any, h: CreateElement): VNode {
    const table = h(
      'el-table',
      {
        attrs: this.$attrs,
        on: this.$listeners,
        props: {
          border: true,
          data: this.data,
          size: this.size
        }
      },
      [
        ...this.visibleColumns.map((column: ProTableColumn, index: number) =>
          this.renderColumn(h, column, index)
        ),
        ...(this.$slots.default || [])
      ]
    )

    const pagination = this.shouldShowPagination
      ? h(Pagination, {
          class: 'pro-table__pagination',
          props: {
            total: this.total,
            page: this.page,
            limit: this.limit,
            ...this.paginationProps
          },
          on: {
            'update:page': this.handleUpdatePage,
            'update:limit': this.handleUpdateLimit,
            pagination: this.handlePagination
          }
        })
      : null

    const loadingTable = h(
      Loading,
      {
        props: {
          ...this.loadingProps,
          loading: this.loading
        }
      },
      [table]
    )

    return h('div', { class: ['x-pro-table', 'pro-table'] }, [loadingTable, pagination])
  }
})
