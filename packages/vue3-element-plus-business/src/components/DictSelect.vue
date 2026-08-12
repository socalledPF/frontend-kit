<script setup lang="ts">
import { computed } from 'vue'
import type { BusinessDictOption, DictValue } from '@amusite/business-core'

const props = withDefaults(defineProps<{
  modelValue?: DictValue | DictValue[]
  options?: BusinessDictOption[]
  multiple?: boolean
  clearable?: boolean
  filterable?: boolean
  disabled?: boolean
  loading?: boolean
  collapseTags?: boolean
  placeholder?: string
  size?: string
}>(), {
  options: () => [], multiple: false, clearable: true, filterable: false, disabled: false,
  loading: false, collapseTags: false, placeholder: '请选择', size: undefined
})
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; change: [value: unknown] }>()
defineSlots<{ option?: (scope: { option: BusinessDictOption; index: number }) => unknown; empty?: () => unknown; prefix?: () => unknown }>()
const value = computed({ get: () => props.modelValue, set: (next) => emit('update:modelValue', next) })
</script>

<template>
  <el-select
    v-bind="$attrs"
    v-model="value"
    class="x-dict-select"
    :multiple="multiple"
    :clearable="clearable"
    :filterable="filterable"
    :disabled="disabled"
    :loading="loading"
    :collapse-tags="collapseTags"
    :placeholder="placeholder"
    :size="size as any"
    @change="emit('change', $event)"
  >
    <template v-if="$slots.prefix" #prefix><slot name="prefix" /></template>
    <el-option v-for="(option, index) in options" :key="String(option.value)" :label="option.label" :value="option.value" :disabled="option.disabled">
      <slot name="option" :option="option" :index="index" />
    </el-option>
    <template v-if="$slots.empty" #empty><slot name="empty" /></template>
  </el-select>
</template>
