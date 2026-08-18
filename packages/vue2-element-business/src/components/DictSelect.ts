import Vue, { type CreateElement, type VNode } from 'vue'
import type { BusinessDictOption } from '../types'
import { getBusinessContext } from '../context'

export default Vue.extend({
  name: 'DictSelect',
  inheritAttrs: false,
  props: {
    value: {
      default: undefined
    },
    options: {
      type: Array,
      default: () => []
    },
    multiple: {
      type: Boolean,
      default: false
    },
    clearable: {
      type: Boolean,
      default: true
    },
    filterable: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    },
    collapseTags: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: ''
    },
    size: {
      type: String,
      default: undefined
    }
  },
  methods: {
    handleInput(this: any, value: unknown) {
      this.$emit('input', value)
    },
    handleChange(this: any, value: unknown) {
      this.$emit('change', value)
    },
    renderOption(this: any, h: CreateElement, option: BusinessDictOption, index: number) {
      const content = this.$scopedSlots.option?.({ option, index })

      return h(
        'el-option',
        {
          key: String(option.value),
          props: {
            label: option.label,
            value: option.value,
            disabled: option.disabled
          }
        },
        content
      )
    }
  },
  render(this: any, h: CreateElement): VNode {
    const forwardedListeners = { ...this.$listeners }
    delete forwardedListeners.input
    delete forwardedListeners.change
    const options = this.options.map((option: BusinessDictOption, index: number) =>
      this.renderOption(h, option, index)
    )

    return h(
      'el-select',
      {
        class: 'x-dict-select',
        attrs: this.$attrs,
        props: {
          ...this.$attrs,
          value: this.value,
          multiple: this.multiple,
          clearable: this.clearable,
          filterable: this.filterable,
          disabled: this.disabled,
          loading: this.loading,
          collapseTags: this.collapseTags,
          placeholder: this.placeholder || getBusinessContext(this).t('dict.placeholder'),
          size: this.size
        },
        on: {
          ...forwardedListeners,
          input: this.handleInput,
          change: this.handleChange
        }
      },
      [...options, ...(this.$slots.default || [])]
    )
  }
})
