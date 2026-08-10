import Vue, { type CreateElement, type VNode } from 'vue'
import type { BusinessDictOption, DictValue } from '../types'

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

export default Vue.extend({
  name: 'DictTag',
  inheritAttrs: false,
  props: {
    value: {
      type: [String, Number, Array],
      default: undefined
    },
    options: {
      type: Array,
      default: () => []
    },
    strict: {
      type: Boolean,
      default: false
    },
    separator: {
      type: String,
      default: ','
    },
    emptyText: {
      type: String,
      default: '--'
    },
    fallback: {
      type: [String, Function],
      default: undefined
    },
    size: {
      type: String,
      default: 'small'
    },
    effect: {
      type: String,
      default: 'light'
    },
    hit: {
      type: Boolean,
      default: false
    },
    disableTransitions: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    getValues(this: any): DictValue[] {
      if (Array.isArray(this.value)) {
        return this.value.filter((value: unknown) => !isEmptyValue(value)) as DictValue[]
      }

      if (isEmptyValue(this.value)) {
        return []
      }

      return [this.value as DictValue]
    },
    findOption(this: any, value: DictValue): BusinessDictOption | undefined {
      return this.options.find((option: BusinessDictOption) =>
        this.strict ? option.value === value : String(option.value) === String(value)
      )
    },
    resolveFallback(this: any, value: DictValue): string {
      if (typeof this.fallback === 'function') {
        return String(this.fallback(value))
      }

      if (typeof this.fallback === 'string') {
        return this.fallback
      }

      return String(value)
    },
    renderTag(this: any, h: CreateElement, value: DictValue, index: number): VNode {
      const option = this.findOption(value)
      const label = option?.label ?? this.resolveFallback(value)
      const slot = this.$scopedSlots.default?.({ option, value, label })

      if (slot) {
        return h('span', { key: `${value}-${index}`, class: 'x-dict-tag__custom' }, slot)
      }

      const type = option?.type ?? option?.elTagType
      const className = option?.className ?? option?.elTagClass ?? option?.listClass

      return h(
        'el-tag',
        {
          key: `${value}-${index}`,
          class: ['x-dict-tag__item', className],
          attrs: this.$attrs,
          props: {
            type,
            color: option?.color,
            size: this.size,
            effect: this.effect,
            hit: this.hit,
            disableTransitions: this.disableTransitions
          },
          on: {
            click: (event: MouseEvent) => this.$emit('click', option, value, event)
          }
        },
        [label]
      )
    }
  },
  render(this: any, h: CreateElement): VNode {
    const values = this.getValues()

    if (values.length === 0) {
      return h('span', { class: 'x-dict-tag__empty' }, [this.emptyText])
    }

    const children: VNode[] = []
    values.forEach((value: DictValue, index: number) => {
      if (index > 0) {
        children.push(h('span', { class: 'x-dict-tag__separator' }, [this.separator]))
      }
      children.push(this.renderTag(h, value, index))
    })

    return h('span', { class: 'x-dict-tag' }, children)
  }
})
