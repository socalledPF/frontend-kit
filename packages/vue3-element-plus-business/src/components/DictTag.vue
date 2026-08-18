<script setup lang="ts">
import { computed } from 'vue'
import type { BusinessDictOption, DictValue } from '@amusite/business-core'

const props = withDefaults(
  defineProps<{
    value?: DictValue | DictValue[]
    options?: BusinessDictOption[]
    strict?: boolean
    separator?: string
    emptyText?: string
    fallback?: string | ((value: DictValue) => string)
    size?: string
    effect?: string
    hit?: boolean
    disableTransitions?: boolean
  }>(),
  {
    options: () => [],
    strict: false,
    separator: ',',
    emptyText: '--',
    size: 'small',
    effect: 'light',
    hit: false,
    disableTransitions: false
  }
)
const emit = defineEmits<{
  click: [option: BusinessDictOption | undefined, value: DictValue, event: MouseEvent]
}>()
defineSlots<{
  default?: (scope: { option?: BusinessDictOption; value: DictValue; label: string }) => unknown
}>()
const empty = (value: unknown) => value === undefined || value === null || value === ''
const values = computed<DictValue[]>(() =>
  Array.isArray(props.value)
    ? props.value.filter((item) => !empty(item))
    : empty(props.value)
      ? []
      : [props.value as DictValue]
)
const optionFor = (value: DictValue) =>
  props.options.find((option) =>
    props.strict ? option.value === value : String(option.value) === String(value)
  )
const labelFor = (value: DictValue, option?: BusinessDictOption) =>
  option?.label ??
  (typeof props.fallback === 'function'
    ? String(props.fallback(value))
    : (props.fallback ?? String(value)))
</script>

<template>
  <span v-if="values.length" class="x-dict-tag">
    <template v-for="(item, index) in values" :key="`${item}-${index}`">
      <span v-if="index" class="x-dict-tag__separator">{{ separator }}</span>
      <slot :option="optionFor(item)" :value="item" :label="labelFor(item, optionFor(item))">
        <el-tag
          v-bind="$attrs"
          class="x-dict-tag__item"
          :class="
            optionFor(item)?.className || optionFor(item)?.elTagClass || optionFor(item)?.listClass
          "
          :type="(optionFor(item)?.type || optionFor(item)?.elTagType) as any"
          :color="optionFor(item)?.color"
          :size="size as any"
          :effect="effect as any"
          :hit="hit"
          :disable-transitions="disableTransitions"
          @click="emit('click', optionFor(item), item, $event)"
          >{{ labelFor(item, optionFor(item)) }}</el-tag
        >
      </slot>
    </template>
  </span>
  <span v-else class="x-dict-tag__empty">{{ emptyText }}</span>
</template>
