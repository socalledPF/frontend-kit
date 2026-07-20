import Vue, { type CreateElement, type VNode } from 'vue'
import type { QueryFormBreakpointCols, QueryFormField, QueryFormModel } from '../types'

const DEFAULT_BREAKPOINT_COLS: Required<QueryFormBreakpointCols> = {
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 4
}

const CLEARABLE_COMPONENTS = [
  'el-input',
  'el-select',
  'el-date-picker',
  'el-time-picker',
  'el-time-select',
  'el-cascader',
  'el-autocomplete'
]

function cloneModel(model: unknown): QueryFormModel {
  if (!model || typeof model !== 'object') {
    return {}
  }

  return JSON.parse(JSON.stringify(model))
}

function isEnterKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.keyCode === 13
}

export default Vue.extend({
  name: 'QueryForm',
  inheritAttrs: false,
  props: {
    model: {
      type: Object,
      default: () => ({})
    },
    fields: {
      type: Array,
      default: () => []
    },
    maxRows: {
      type: Number,
      default: 1
    },
    breakpointCols: {
      type: Object,
      default: () => ({})
    },
    labelWidth: {
      type: String,
      default: '80px'
    },
    gutter: {
      type: Number,
      default: 12
    },
    showToggle: {
      type: Boolean,
      default: true
    },
    showActions: {
      type: Boolean,
      default: true
    },
    queryText: {
      type: String,
      default: '查询'
    },
    resetText: {
      type: String,
      default: '重置'
    },
    expandText: {
      type: String,
      default: '展开'
    },
    collapseText: {
      type: String,
      default: '收起'
    }
  },
  data() {
    return {
      innerModel: {},
      initialSnapshot: {},
      modelReference: null,
      expanded: false,
      resetVersion: 0,
      windowWidth:
        typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1920,
      syncingFromInner: false
    }
  },
  computed: {
    mergedBreakpointCols(this: any) {
      return {
        ...DEFAULT_BREAKPOINT_COLS,
        ...this.breakpointCols
      }
    },
    normalizedMaxRows(this: any) {
      const value = Number(this.maxRows)
      return value > 0 ? value : 1
    },
    activeBreakpoint(this: any) {
      const width = this.windowWidth

      if (width < 768) {
        return 'xs'
      }
      if (width < 992) {
        return 'sm'
      }
      if (width < 1200) {
        return 'md'
      }
      if (width < 1920) {
        return 'lg'
      }
      return 'xl'
    },
    columnsPerRow(this: any) {
      const columns = Number(this.mergedBreakpointCols[this.activeBreakpoint])
      return columns > 0 ? columns : 1
    },
    baseSpan(this: any) {
      return Math.max(1, Math.floor(24 / this.columnsPerRow))
    },
    visibleFields(this: any) {
      return this.fields.filter((field: QueryFormField) => field && field.visible !== false)
    },
    fieldRows(this: any) {
      const rows: Array<Array<{ field: QueryFormField; span: number; index: number }>> = []
      let currentRow: Array<{ field: QueryFormField; span: number; index: number }> = []
      let rowUsedSpan = 0

      this.visibleFields.forEach((field: QueryFormField, index: number) => {
        const span = this.getFieldSpan(field)

        if (currentRow.length > 0 && rowUsedSpan + span > 24) {
          rows.push(currentRow)
          currentRow = []
          rowUsedSpan = 0
        }

        currentRow.push({ field, span, index })
        rowUsedSpan += span
      })

      if (currentRow.length > 0) {
        rows.push(currentRow)
      }

      return rows
    },
    shouldShowToggle(this: any) {
      return this.showToggle && this.fieldRows.length > this.normalizedMaxRows
    },
    visibleRows(this: any) {
      if (!this.shouldShowToggle || this.expanded) {
        return this.fieldRows
      }

      return this.fieldRows.slice(0, this.normalizedMaxRows)
    }
  },
  watch: {
    model: {
      immediate: true,
      deep: true,
      handler(this: any, newModel: QueryFormModel) {
        if (this.syncingFromInner) {
          return
        }

        this.innerModel = this.normalizeModel(newModel)

        if (newModel !== this.modelReference) {
          this.modelReference = newModel
          this.initialSnapshot = this.normalizeModel(newModel)
        }
      }
    },
    innerModel: {
      deep: true,
      handler(this: any, value: QueryFormModel) {
        this.syncingFromInner = true
        this.$emit('update:model', cloneModel(value))
        this.$nextTick(() => {
          this.syncingFromInner = false
        })
      }
    },
    shouldShowToggle(this: any, value: boolean) {
      if (!value) {
        this.expanded = false
      }
    }
  },
  mounted(this: any) {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleWindowResize)
    }
  },
  beforeDestroy(this: any) {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleWindowResize)
    }
  },
  methods: {
    cloneModel,
    normalizeModel(this: any, model: QueryFormModel) {
      const nextModel = cloneModel(model)

      this.visibleFields.forEach((field: QueryFormField) => {
        if (!this.isSplitRangeField(field)) {
          return
        }

        const rangeValue = nextModel[field.prop]

        if (Array.isArray(rangeValue)) {
          nextModel[this.getRangeStartProp(field)] = this.normalizeRangeEdgeValue(rangeValue[0])
          nextModel[this.getRangeEndProp(field)] = this.normalizeRangeEdgeValue(rangeValue[1])
        }

        delete nextModel[field.prop]
      })

      return nextModel
    },
    handleWindowResize(this: any) {
      this.windowWidth = window.innerWidth
    },
    resolveFieldComponent(field: QueryFormField) {
      return field.component || 'el-input'
    },
    getFieldSpan(this: any, field: QueryFormField) {
      const colSpan = Number(field.colSpan)
      const normalizedColSpan = colSpan > 0 ? colSpan : 1
      const span = this.baseSpan * normalizedColSpan
      return Math.max(1, Math.min(24, span))
    },
    normalizeComponentName(component: unknown) {
      return typeof component === 'string' ? component.toLowerCase() : ''
    },
    shouldAutoClearable(componentName: string) {
      return CLEARABLE_COMPONENTS.includes(componentName)
    },
    getMergedComponentProps(this: any, field: QueryFormField) {
      const props = { ...(field.componentProps || {}) }

      if (Object.prototype.hasOwnProperty.call(props, 'clearable')) {
        return props
      }

      const componentName = this.normalizeComponentName(this.resolveFieldComponent(field))

      if (this.shouldAutoClearable(componentName)) {
        props.clearable = true
      }

      return props
    },
    hasFieldSlot(this: any, field: QueryFormField) {
      return Boolean(field.slotName && this.$scopedSlots[field.slotName])
    },
    getFieldSlotScope(this: any, field: QueryFormField) {
      return {
        model: this.innerModel,
        field,
        value: this.getFieldValue(field),
        update: (value: unknown) => this.handleFieldInput(field, value)
      }
    },
    getFieldKey(field: QueryFormField, index: number) {
      return field.prop || field.slotName || `query-field-${index}`
    },
    getFieldControlKey(this: any, field: QueryFormField, index: number) {
      return `${this.getFieldKey(field, index)}-${this.resetVersion}`
    },
    isSplitRangeField(field: QueryFormField) {
      return Boolean(field && field.valueMode === 'split-range')
    },
    getRangeStartProp(field: QueryFormField) {
      return field.startProp || `${field.prop}Start`
    },
    getRangeEndProp(field: QueryFormField) {
      return field.endProp || `${field.prop}End`
    },
    getFieldFormProp(this: any, field: QueryFormField) {
      if (this.isSplitRangeField(field)) {
        return this.getRangeStartProp(field)
      }

      return field.prop
    },
    getFieldValue(this: any, field: QueryFormField) {
      if (!this.isSplitRangeField(field)) {
        return this.innerModel[field.prop]
      }

      const start = this.innerModel[this.getRangeStartProp(field)]
      const end = this.innerModel[this.getRangeEndProp(field)]

      if (start === undefined && end === undefined) {
        return []
      }

      return [start, end]
    },
    handleFieldInput(this: any, field: QueryFormField, value: unknown) {
      if (!this.isSplitRangeField(field)) {
        this.$set(this.innerModel, field.prop, value)
        return
      }

      const rangeValue = Array.isArray(value) ? value : []
      this.$set(
        this.innerModel,
        this.getRangeStartProp(field),
        this.normalizeRangeEdgeValue(rangeValue[0])
      )
      this.$set(
        this.innerModel,
        this.getRangeEndProp(field),
        this.normalizeRangeEdgeValue(rangeValue[1])
      )

      if (Object.prototype.hasOwnProperty.call(this.innerModel, field.prop)) {
        this.$delete(this.innerModel, field.prop)
      }
    },
    normalizeRangeEdgeValue(value: unknown) {
      if (value === '' || value === null || value === undefined) {
        return undefined
      }

      return value
    },
    isRadioGroupLayout(field: QueryFormField) {
      return field && field.layout === 'radio-group'
    },
    getFieldControlClasses(this: any, field: QueryFormField) {
      return {
        'query-form__control': true,
        'query-form__control--radio-group': this.isRadioGroupLayout(field)
      }
    },
    handleQuery(this: any) {
      this.$emit('query', cloneModel(this.innerModel))
    },
    handleReset(this: any) {
      const nextModel = cloneModel(this.initialSnapshot)
      this.innerModel = nextModel
      this.resetVersion += 1

      if (this.$refs.queryForm) {
        this.$refs.queryForm.clearValidate()
      }

      this.$nextTick(() => {
        this.$emit('reset', cloneModel(this.innerModel))
      })
    },
    toggleExpand(this: any) {
      this.expanded = !this.expanded
    },
    renderFieldControl(this: any, h: CreateElement, field: QueryFormField, index: number) {
      const slotName = field.slotName

      if (this.hasFieldSlot(field) && slotName) {
        return this.$scopedSlots[slotName](this.getFieldSlotScope(field))
      }

      return h(this.resolveFieldComponent(field), {
        key: this.getFieldControlKey(field, index),
        props: {
          value: this.getFieldValue(field),
          ...this.getMergedComponentProps(field)
        },
        on: {
          input: (value: unknown) => this.handleFieldInput(field, value)
        },
        nativeOn: {
          keyup: (event: KeyboardEvent) => {
            if (isEnterKey(event)) {
              this.handleQuery()
            }
          }
        }
      })
    }
  },
  render(this: any, h: CreateElement): VNode {
    const rows = this.visibleRows.map(
      (row: Array<{ field: QueryFormField; span: number; index: number }>, rowIndex: number) =>
        h(
          'el-row',
          {
            key: `query-row-${rowIndex}`,
            class: 'query-form__row',
            props: {
              gutter: this.gutter
            }
          },
          row.map((item) =>
            h(
              'el-col',
              {
                key: this.getFieldKey(item.field, item.index),
                props: {
                  span: item.span
                }
              },
              [
                h(
                  'el-form-item',
                  {
                    props: {
                      label: item.field.label,
                      prop: this.getFieldFormProp(item.field)
                    }
                  },
                  [
                    h(
                      'div',
                      {
                        class: this.getFieldControlClasses(item.field)
                      },
                      [this.renderFieldControl(h, item.field, item.index)]
                    )
                  ]
                )
              ]
            )
          )
        )
    )

    const actions =
      this.showActions || this.shouldShowToggle
        ? [
            h('div', { class: 'query-form__footer' }, [
              h('div', { class: 'query-form__action-bar' }, [
                this.showActions
                  ? h(
                      'el-button',
                      {
                        props: {
                          type: 'primary',
                          icon: 'el-icon-search',
                          size: 'mini'
                        },
                        on: {
                          click: this.handleQuery
                        }
                      },
                      [this.queryText]
                    )
                  : null,
                this.showActions
                  ? h(
                      'el-button',
                      {
                        props: {
                          icon: 'el-icon-refresh',
                          size: 'mini'
                        },
                        on: {
                          click: this.handleReset
                        }
                      },
                      [this.resetText]
                    )
                  : null,
                this.shouldShowToggle
                  ? h(
                      'el-button',
                      {
                        class: 'query-form__toggle',
                        props: {
                          type: 'text'
                        },
                        on: {
                          click: this.toggleExpand
                        }
                      },
                      [
                        this.expanded ? this.collapseText : this.expandText,
                        h('i', {
                          class: this.expanded ? 'el-icon-arrow-up' : 'el-icon-arrow-down'
                        })
                      ]
                    )
                  : null
              ])
            ])
          ]
        : []

    return h('div', { class: ['x-query-form', 'query-form'] }, [
      h(
        'el-form',
        {
          ref: 'queryForm',
          attrs: this.$attrs,
          props: {
            model: this.innerModel,
            labelWidth: this.labelWidth,
            size: 'small'
          },
          nativeOn: {
            submit: (event: Event) => {
              event.preventDefault()
            }
          }
        },
        [...rows, ...actions]
      )
    ])
  }
})
