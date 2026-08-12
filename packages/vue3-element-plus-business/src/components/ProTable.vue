<script setup lang="ts">
import { computed } from 'vue'
import type { ProTableColumn, TableDensity } from '@amusite/business-core'
import Loading from './Loading.vue'
import Pagination from './Pagination.vue'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  data?: unknown[]
  columns?: ProTableColumn[]
  loading?: boolean
  loadingProps?: Record<string, unknown>
  size?: string | TableDensity
  page?: number
  limit?: number
  total?: number
  showPagination?: boolean
  paginationHiddenWhenNoData?: boolean
  paginationProps?: Record<string, unknown>
}>(), {
  data: () => [], columns: () => [], loading: false, loadingProps: () => ({}), page: 1,
  limit: 20, total: 0, showPagination: true, paginationHiddenWhenNoData: true,
  paginationProps: () => ({})
})
const emit = defineEmits<{
  'update:page': [value: number]
  'update:limit': [value: number]
  pagination: [payload: unknown]
}>()
const visibleColumns = computed(() => props.columns.filter((column) => column.visible !== false))
const shouldShowPagination = computed(() => props.showPagination && (!props.paginationHiddenWhenNoData || props.total > 0))
const tableSize = computed(() => props.size === 'medium' ? 'default' : props.size === 'mini' ? 'small' : props.size)
const reserved = new Set(['visible', 'slotName', 'headerSlotName', 'columnSetting', 'key'])
function columnProps(column: ProTableColumn) {
  const result = Object.fromEntries(Object.entries(column).filter(([key, value]) => !reserved.has(key) && value !== undefined))
  if (result.showOverflowTooltip === undefined) result.showOverflowTooltip = column.type ? false : true
  return result
}
const columnKey = (column: ProTableColumn, index: number) => String(column.key || column.prop || column.type || column.slotName || column.headerSlotName || `column-${index}`)
</script>

<template>
  <div class="x-pro-table pro-table" :class="{ 'x-pro-table--mini': size === 'mini' }">
    <Loading v-bind="loadingProps" :loading="loading">
      <el-table v-bind="$attrs" :data="data" border :size="tableSize as any">
        <el-table-column v-for="(column, index) in visibleColumns" :key="columnKey(column, index)" v-bind="columnProps(column)">
          <template v-if="column.headerSlotName && $slots[column.headerSlotName]" #header="scope">
            <slot :name="column.headerSlotName" :column="scope.column" :index="scope.$index" :column-config="column" />
          </template>
          <template v-if="column.slotName && $slots[column.slotName]" #default="scope">
            <slot :name="column.slotName" :row="scope.row" :column="scope.column" :index="scope.$index" :column-config="column" />
          </template>
        </el-table-column>
        <slot />
      </el-table>
    </Loading>
    <Pagination
      v-if="shouldShowPagination"
      v-bind="paginationProps"
      class="pro-table__pagination"
      :total="total"
      :page="page"
      :limit="limit"
      @update:page="emit('update:page', $event)"
      @update:limit="emit('update:limit', $event)"
      @pagination="emit('pagination', $event)"
    />
  </div>
</template>
