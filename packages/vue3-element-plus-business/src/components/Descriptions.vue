<script setup lang="ts">
import { computed } from 'vue'
import { getByPath } from '@amusite/business-core'
import type { DescriptionItem } from '@amusite/business-core'
import DictTag from './DictTag.vue'

const props = withDefaults(defineProps<{
  data?: Record<string, unknown>
  items?: DescriptionItem[]
  title?: string
  column?: number
  border?: boolean
  direction?: 'horizontal' | 'vertical'
  size?: string
  labelWidth?: string | number
  emptyText?: string
}>(), { data: () => ({}), items: () => [], title: '', column: 3, border: true, direction: 'horizontal', size: 'small', emptyText: '--' })
const visibleItems = computed(() => props.items.filter((item) => item && item.visible !== false))
const valueFor = (item: DescriptionItem) => getByPath(props.data, item.prop)
const empty = (value: unknown) => value === undefined || value === null || value === ''
const displayValue = (item: DescriptionItem) => {
  const raw = valueFor(item)
  const value = item.formatter ? item.formatter(raw, props.data, item) : raw
  return empty(value) ? item.emptyText ?? props.emptyText : value
}
</script>

<template>
  <el-descriptions v-bind="$attrs" class="x-descriptions" :title="title" :column="Math.max(1, Number(column) || 1)" :border="border" :direction="direction" :size="size as any">
    <template v-if="$slots.title" #title><slot name="title" /></template>
    <template v-if="$slots.extra" #extra><slot name="extra" /></template>
    <el-descriptions-item
      v-for="item in visibleItems"
      :key="item.prop"
      :label="item.label || item.prop"
      :span="item.span || 1"
      :width="item.width"
      :min-width="item.minWidth"
      :align="item.align"
      :label-align="item.labelAlign"
      :class-name="item.className"
      :label-class-name="item.labelClassName"
      :label-style="labelWidth ? { width: typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth } : undefined"
    >
      <template v-if="item.labelSlotName && $slots[item.labelSlotName]" #label>
        <slot :name="item.labelSlotName" :row="data" :item="item" :value="valueFor(item)" />
      </template>
      <slot v-if="item.slotName && $slots[item.slotName]" :name="item.slotName" :row="data" :item="item" :value="valueFor(item)" />
      <DictTag v-else-if="item.dictOptions" :value="valueFor(item) as any" :options="item.dictOptions" :empty-text="item.emptyText ?? emptyText" />
      <template v-else>{{ displayValue(item) }}</template>
    </el-descriptions-item>
  </el-descriptions>
</template>
