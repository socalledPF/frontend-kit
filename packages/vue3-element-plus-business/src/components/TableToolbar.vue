<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { FullScreen, Grid, Operation, Refresh, Search, SwitchButton } from '@element-plus/icons-vue'
import type { ProTableColumn, TableDensity, TableToolbarPreferences } from '@amusite/business-core'
import { useBusinessContext } from '../context'

const props = withDefaults(
  defineProps<{
    showSearch?: boolean
    showSearchToggle?: boolean
    showRefresh?: boolean
    refreshing?: boolean
    density?: TableDensity
    showDensity?: boolean
    columns?: ProTableColumn[]
    showColumnSetting?: boolean
    showFullscreen?: boolean
    fullscreenTarget?: string | HTMLElement | (() => HTMLElement | undefined)
    storageKey?: string
  }>(),
  {
    showSearch: true,
    showSearchToggle: true,
    showRefresh: true,
    refreshing: false,
    density: 'medium',
    showDensity: true,
    columns: () => [],
    showColumnSetting: true,
    showFullscreen: true,
    storageKey: ''
  }
)
const emit = defineEmits<{
  'update:showSearch': [value: boolean]
  'update:density': [value: TableDensity]
  'update:columns': [value: ProTableColumn[]]
  'search-toggle': [value: boolean]
  refresh: []
  'density-change': [value: TableDensity]
  'column-change': [detail: Record<string, unknown>]
  'fullscreen-change': [value: boolean]
  'fullscreen-error': [error: unknown]
}>()
defineSlots<{
  default?: (scope: Record<string, unknown>) => unknown
  left?: (scope: Record<string, unknown>) => unknown
  right?: (scope: Record<string, unknown>) => unknown
}>()
const instance = getCurrentInstance()
const business = useBusinessContext()
const densityOptions = computed<Array<{ label: string; value: TableDensity }>>(() => [
  { label: business.t('table.densityMedium'), value: 'medium' },
  { label: business.t('table.densitySmall'), value: 'small' },
  { label: business.t('table.densityMini'), value: 'mini' }
])
const fullscreen = ref(false)
const initialVisibility = reactive<Record<string, boolean>>({})
const columnKey = (column: ProTableColumn, index: number) =>
  String(column.key ?? column.prop ?? column.label ?? `column-${index}`)
const configurableColumns = computed(() =>
  props.columns
    .map((column, index) => ({ column, index, key: columnKey(column, index) }))
    .filter(({ column }) => column.columnSetting !== false)
)
const visibleColumnCount = computed(
  () => configurableColumns.value.filter(({ column }) => column.visible !== false).length
)
const allColumnsVisible = computed(
  () =>
    configurableColumns.value.length > 0 &&
    visibleColumnCount.value === configurableColumns.value.length
)
const columnsIndeterminate = computed(
  () => visibleColumnCount.value > 0 && !allColumnsVisible.value
)
watch(
  () => props.columns,
  (columns) =>
    columns.forEach((column, index) => {
      const key = columnKey(column, index)
      if (!(key in initialVisibility)) initialVisibility[key] = column.visible !== false
    }),
  { immediate: true, deep: true }
)
const storageName = () => (props.storageKey ? `amusite:table-toolbar:${props.storageKey}` : '')
function readPreferences(): TableToolbarPreferences | undefined {
  if (!storageName()) return undefined
  const storage =
    business.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
  try {
    const value = storage?.getItem(storageName())
    return value ? JSON.parse(value) : undefined
  } catch {
    return undefined
  }
}
function writePreferences(
  columns = props.columns,
  density = props.density,
  preserveColumns = false
) {
  if (!storageName()) return
  const storage =
    business.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
  if (!storage) return
  const stored = preserveColumns ? readPreferences()?.columns : undefined
  const values =
    stored ??
    columns.reduce<Record<string, boolean>>((result, column, index) => {
      result[columnKey(column, index)] = column.visible !== false
      return result
    }, {})
  try {
    storage.setItem(storageName(), JSON.stringify({ density, columns: values }))
  } catch {
    /* restricted storage */
  }
}
function updateColumns(
  type: string,
  update: (column: ProTableColumn, index: number) => ProTableColumn,
  detail: Record<string, unknown> = {}
) {
  const columns = props.columns.map(update)
  emit('update:columns', columns)
  emit('column-change', { type, ...detail, columns })
  writePreferences(columns)
}
function toggleSearch() {
  emit('update:showSearch', !props.showSearch)
  emit('search-toggle', !props.showSearch)
}
function refresh() {
  if (!props.refreshing) emit('refresh')
}
function changeDensity(value: TableDensity) {
  if (!densityOptions.value.some((item) => item.value === value)) return
  emit('update:density', value)
  emit('density-change', value)
  writePreferences(props.columns, value, true)
}
function updateColumnVisibility(key: string, visible: boolean) {
  updateColumns(
    'visibility',
    (column, index) => (columnKey(column, index) === key ? { ...column, visible } : { ...column }),
    { key, visible }
  )
}
function updateAllColumns(visible: boolean) {
  const keys = new Set(configurableColumns.value.map((item) => item.key))
  updateColumns(
    'all',
    (column, index) =>
      keys.has(columnKey(column, index)) ? { ...column, visible } : { ...column },
    { visible }
  )
}
function resetColumns() {
  updateColumns('reset', (column, index) => ({
    ...column,
    visible: initialVisibility[columnKey(column, index)] ?? true
  }))
}
function resolveFullscreenTarget() {
  if (typeof document === 'undefined') return undefined
  if (typeof props.fullscreenTarget === 'string')
    return document.querySelector<HTMLElement>(props.fullscreenTarget) || undefined
  if (typeof props.fullscreenTarget === 'function') return props.fullscreenTarget()
  return (
    props.fullscreenTarget ||
    (instance?.proxy?.$el as HTMLElement | undefined)?.parentElement ||
    undefined
  )
}
async function toggleFullscreen() {
  if (typeof document === 'undefined') return
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else {
      const target = resolveFullscreenTarget()
      if (!target?.requestFullscreen) throw new Error(business.t('table.fullscreenUnsupported'))
      await target.requestFullscreen()
    }
  } catch (error) {
    business.notifyError?.(error, { source: 'TableToolbar', action: 'fullscreen' })
    emit('fullscreen-error', error)
  }
}
function handleFullscreenChange() {
  const value = typeof document !== 'undefined' && Boolean(document.fullscreenElement)
  if (value !== fullscreen.value) {
    fullscreen.value = value
    emit('fullscreen-change', value)
  }
}
function restorePreferences() {
  const value = readPreferences()
  if (!value) return
  if (
    value.density &&
    densityOptions.value.some((item) => item.value === value.density) &&
    value.density !== props.density
  ) {
    emit('update:density', value.density)
    emit('density-change', value.density)
  }
  if (value.columns)
    updateColumns('restore', (column, index) =>
      columnKey(column, index) in value.columns!
        ? { ...column, visible: value.columns![columnKey(column, index)] }
        : { ...column }
    )
}
onMounted(() => {
  restorePreferences()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  handleFullscreenChange()
})
onBeforeUnmount(
  () =>
    typeof document !== 'undefined' &&
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
)
defineExpose({
  toggleSearch,
  refresh,
  changeDensity,
  updateColumnVisibility,
  updateAllColumns,
  resetColumns,
  toggleFullscreen
})
</script>

<template>
  <div v-bind="$attrs" class="x-table-toolbar" role="toolbar">
    <div class="x-table-toolbar__left">
      <slot name="left" v-bind="{ showSearch, refreshing, density, columns }"
        ><slot v-bind="{ showSearch, refreshing, density, columns }"
      /></slot>
    </div>
    <div class="x-table-toolbar__right">
      <slot name="right" v-bind="{ showSearch, refreshing, density, columns }" />
      <el-tooltip
        v-if="showSearchToggle"
        :content="showSearch ? business.t('query.collapse') : business.t('query.expand')"
        placement="top"
        :show-after="300"
      >
        <el-button
          circle
          size="small"
          class="x-table-toolbar__button"
          :type="showSearch ? 'primary' : 'default'"
          :aria-label="showSearch ? business.t('query.collapse') : business.t('query.expand')"
          @click="toggleSearch"
          ><el-icon><Search /></el-icon
        ></el-button>
      </el-tooltip>
      <el-tooltip
        v-if="showRefresh"
        :content="business.t('table.refresh')"
        placement="top"
        :show-after="300"
      >
        <el-button
          circle
          size="small"
          class="x-table-toolbar__button"
          :aria-label="business.t('table.refresh')"
          :disabled="refreshing"
          @click="refresh"
          ><el-icon :class="{ 'x-table-toolbar__icon--loading': refreshing }"><Refresh /></el-icon
        ></el-button>
      </el-tooltip>
      <el-dropdown v-if="showDensity" trigger="click" @command="changeDensity">
        <el-button
          circle
          size="small"
          class="x-table-toolbar__button"
          :aria-label="business.t('table.density')"
          ><el-icon><Operation /></el-icon
        ></el-button>
        <template #dropdown
          ><el-dropdown-menu
            ><el-dropdown-item
              v-for="item in densityOptions"
              :key="item.value"
              :command="item.value"
              :class="{ 'is-active': item.value === density }"
              >{{ item.label }}</el-dropdown-item
            ></el-dropdown-menu
          ></template
        >
      </el-dropdown>
      <el-popover
        v-if="showColumnSetting && configurableColumns.length"
        placement="bottom-end"
        :width="220"
        trigger="click"
      >
        <template #reference
          ><el-button
            circle
            size="small"
            class="x-table-toolbar__button"
            :aria-label="business.t('table.columnSettings')"
            ><el-icon><Grid /></el-icon></el-button
        ></template>
        <div class="x-table-toolbar__column-header">
          <el-checkbox
            :model-value="allColumnsVisible"
            :indeterminate="columnsIndeterminate"
            @update:model-value="updateAllColumns"
            >{{ business.t('table.columnDisplay') }}</el-checkbox
          ><el-button link type="primary" size="small" @click="resetColumns">{{
            business.t('query.reset')
          }}</el-button>
        </div>
        <div class="x-table-toolbar__column-list">
          <el-checkbox
            v-for="item in configurableColumns"
            :key="item.key"
            class="x-table-toolbar__column-item"
            :model-value="item.column.visible !== false"
            @update:model-value="updateColumnVisibility(item.key, Boolean($event))"
            >{{ item.column.label || item.column.prop || item.key }}</el-checkbox
          >
        </div>
      </el-popover>
      <el-tooltip
        v-if="showFullscreen"
        :content="fullscreen ? business.t('table.exitFullscreen') : business.t('table.fullscreen')"
        placement="top"
        :show-after="300"
      >
        <el-button
          circle
          size="small"
          class="x-table-toolbar__button"
          :type="fullscreen ? 'primary' : 'default'"
          :aria-label="
            fullscreen ? business.t('table.exitFullscreen') : business.t('table.fullscreen')
          "
          @click="toggleFullscreen"
          ><el-icon><SwitchButton v-if="fullscreen" /><FullScreen v-else /></el-icon
        ></el-button>
      </el-tooltip>
    </div>
  </div>
</template>
