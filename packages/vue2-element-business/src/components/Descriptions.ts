import Vue, { type CreateElement, type VNode } from 'vue'
import type { DescriptionItem } from '../types'
import DictTag from './DictTag'

type DescriptionRow = Record<string, unknown>

function getByPath(source: unknown, path: string): unknown {
  if (!path) {
    return source
  }

  return path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((value, key) => {
      if (!value || typeof value !== 'object') {
        return undefined
      }

      return (value as Record<string, unknown>)[key]
    }, source)
}

function isEmptyDisplayValue(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

export default Vue.extend({
  name: 'Descriptions',
  inheritAttrs: false,
  props: {
    data: {
      type: Object,
      default: () => ({})
    },
    items: {
      type: Array,
      default: () => []
    },
    title: {
      type: String,
      default: ''
    },
    column: {
      type: Number,
      default: 3
    },
    border: {
      type: Boolean,
      default: true
    },
    direction: {
      type: String,
      default: 'horizontal',
      validator: (value: string) => ['horizontal', 'vertical'].includes(value)
    },
    size: {
      type: String,
      default: 'small'
    },
    labelWidth: {
      type: [String, Number],
      default: undefined
    },
    emptyText: {
      type: String,
      default: '--'
    }
  },
  computed: {
    visibleItems(this: any): DescriptionItem[] {
      return this.items.filter((item: DescriptionItem) => item && item.visible !== false)
    }
  },
  methods: {
    getValue(this: any, item: DescriptionItem): unknown {
      return getByPath(this.data, item.prop)
    },
    getSlotScope(this: any, item: DescriptionItem) {
      return {
        row: this.data,
        item,
        value: this.getValue(item)
      }
    },
    renderLabel(this: any, h: CreateElement, item: DescriptionItem): VNode[] | undefined {
      const slotName = item.labelSlotName
      if (!slotName || !this.$scopedSlots[slotName]) {
        return undefined
      }

      return this.$scopedSlots[slotName]?.(this.getSlotScope(item))
    },
    renderValue(this: any, h: CreateElement, item: DescriptionItem): VNode[] | string[] {
      const scope = this.getSlotScope(item)
      if (item.slotName && this.$scopedSlots[item.slotName]) {
        return this.$scopedSlots[item.slotName]?.(scope) || []
      }

      if (item.dictOptions) {
        return [
          h(DictTag, {
            props: {
              value: scope.value,
              options: item.dictOptions,
              emptyText: item.emptyText ?? this.emptyText
            }
          })
        ]
      }

      const value = item.formatter
        ? item.formatter(scope.value, this.data as DescriptionRow, item)
        : scope.value

      return [String(isEmptyDisplayValue(value) ? (item.emptyText ?? this.emptyText) : value)]
    }
  },
  render(this: any, h: CreateElement): VNode {
    const title = this.$slots.title
    const extra = this.$slots.extra

    return h(
      'el-descriptions',
      {
        class: 'x-descriptions',
        attrs: this.$attrs,
        props: {
          title: this.title,
          column: Math.max(1, Number(this.column) || 1),
          border: this.border,
          direction: this.direction,
          size: this.size
        }
      },
      [
        title ? h('template', { slot: 'title' }, title) : null,
        extra ? h('template', { slot: 'extra' }, extra) : null,
        ...this.visibleItems.map((item: DescriptionItem, index: number) => {
          const label = this.renderLabel(h, item)

          return h(
            'el-descriptions-item',
            {
              key: item.prop || index,
              class: item.className,
              props: {
                label: item.label || item.prop,
                span: item.span || 1,
                width: item.width,
                minWidth: item.minWidth,
                align: item.align,
                labelAlign: item.labelAlign,
                labelClassName: item.labelClassName,
                labelStyle: this.labelWidth ? { width: this.labelWidth } : undefined
              }
            },
            [label ? h('template', { slot: 'label' }, label) : null, ...this.renderValue(h, item)]
          )
        })
      ]
    )
  }
})
