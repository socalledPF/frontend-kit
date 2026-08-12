<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Refresh, Search } from '@element-plus/icons-vue'
import { cloneValue, isEqualValue } from '@amusite/business-core'
import type { QueryFormBreakpointCols, QueryFormField, QueryFormModel } from '@amusite/business-core'

const defaults = { xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }
const clearableComponents = ['el-input', 'el-select', 'el-date-picker', 'el-time-picker', 'el-time-select', 'el-cascader', 'el-autocomplete']
const props = withDefaults(defineProps<{
  model?: QueryFormModel
  fields?: QueryFormField[]
  maxRows?: number
  breakpointCols?: QueryFormBreakpointCols
  labelWidth?: string
  gutter?: number
  showToggle?: boolean
  showActions?: boolean
  queryText?: string
  resetText?: string
  expandText?: string
  collapseText?: string
}>(), {
  model: () => ({}), fields: () => [], maxRows: 1, breakpointCols: () => ({}), labelWidth: '80px',
  gutter: 12, showToggle: true, showActions: true, queryText: '查询', resetText: '重置',
  expandText: '展开', collapseText: '收起'
})
const emit = defineEmits<{ 'update:model': [model: QueryFormModel]; query: [model: QueryFormModel]; reset: [model: QueryFormModel] }>()
const formRef = ref<{ clearValidate?: () => void }>()
const innerModel = ref<QueryFormModel>({})
const initialSnapshot = ref<QueryFormModel>({})
const expanded = ref(false)
const resetVersion = ref(0)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
let modelReference: QueryFormModel | undefined
let syncing = false
const visibleFields = computed(() => props.fields.filter((field) => field && field.visible !== false))
const activeBreakpoint = computed(() => windowWidth.value < 768 ? 'xs' : windowWidth.value < 992 ? 'sm' : windowWidth.value < 1200 ? 'md' : windowWidth.value < 1920 ? 'lg' : 'xl')
const columnsPerRow = computed(() => Math.max(1, Number({ ...defaults, ...props.breakpointCols }[activeBreakpoint.value]) || 1))
const baseSpan = computed(() => Math.max(1, Math.floor(24 / columnsPerRow.value)))
const splitRange = (field: QueryFormField) => field.valueMode === 'split-range'
const startProp = (field: QueryFormField) => field.startProp || `${field.prop}Start`
const endProp = (field: QueryFormField) => field.endProp || `${field.prop}End`
const normalizedEdge = (value: unknown) => value === '' || value === null || value === undefined ? undefined : value
function normalizeModel(model: QueryFormModel) {
  const next = cloneValue(model || {})
  visibleFields.value.forEach((field) => {
    if (!splitRange(field)) return
    const range = next[field.prop]
    if (Array.isArray(range)) {
      next[startProp(field)] = normalizedEdge(range[0])
      next[endProp(field)] = normalizedEdge(range[1])
    }
    delete next[field.prop]
  })
  return next
}
watch(() => props.model, (model) => {
  const next = normalizeModel(model)
  if (!syncing && !isEqualValue(next, innerModel.value)) innerModel.value = next
  if (model !== modelReference) {
    modelReference = model
    initialSnapshot.value = cloneValue(next)
  }
}, { immediate: true, deep: true })
watch(innerModel, (value) => {
  syncing = true
  emit('update:model', cloneValue(value))
  void nextTick(() => { syncing = false })
}, { deep: true })
const fieldRows = computed(() => {
  const rows: Array<Array<{ field: QueryFormField; span: number; index: number }>> = []
  let row: Array<{ field: QueryFormField; span: number; index: number }> = []
  let used = 0
  visibleFields.value.forEach((field, index) => {
    const span = Math.max(1, Math.min(24, baseSpan.value * Math.max(1, Number(field.colSpan) || 1)))
    if (row.length && used + span > 24) { rows.push(row); row = []; used = 0 }
    row.push({ field, span, index }); used += span
  })
  if (row.length) rows.push(row)
  return rows
})
const normalizedMaxRows = computed(() => Math.max(1, Number(props.maxRows) || 1))
const shouldShowToggle = computed(() => props.showToggle && fieldRows.value.length > normalizedMaxRows.value)
const visibleRows = computed(() => !shouldShowToggle.value || expanded.value ? fieldRows.value : fieldRows.value.slice(0, normalizedMaxRows.value))
watch(shouldShowToggle, (value) => { if (!value) expanded.value = false })
function fieldValue(field: QueryFormField) {
  if (!splitRange(field)) return innerModel.value[field.prop]
  const start = innerModel.value[startProp(field)]
  const end = innerModel.value[endProp(field)]
  return start === undefined && end === undefined ? [] : [start, end]
}
function updateField(field: QueryFormField, value: unknown) {
  if (!splitRange(field)) innerModel.value[field.prop] = value
  else {
    const range = Array.isArray(value) ? value : []
    innerModel.value[startProp(field)] = normalizedEdge(range[0])
    innerModel.value[endProp(field)] = normalizedEdge(range[1])
    delete innerModel.value[field.prop]
  }
}
function componentProps(field: QueryFormField) {
  const values = { ...(field.componentProps || {}) }
  const name = typeof field.component === 'string' ? field.component.toLowerCase() : 'el-input'
  if (!Object.prototype.hasOwnProperty.call(values, 'clearable') && clearableComponents.includes(name)) values.clearable = true
  return values
}
function handleQuery() { emit('query', cloneValue(innerModel.value)) }
function reset() {
  innerModel.value = cloneValue(initialSnapshot.value)
  resetVersion.value += 1
  formRef.value?.clearValidate?.()
  void nextTick(() => emit('reset', cloneValue(innerModel.value)))
}
function handleKeyup(event: KeyboardEvent) { if (event.key === 'Enter' || event.keyCode === 13) handleQuery() }
const resize = () => { if (typeof window !== 'undefined') windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', resize))
onBeforeUnmount(() => typeof window !== 'undefined' && window.removeEventListener('resize', resize))
defineExpose({ query: handleQuery, reset, toggleExpand: () => { expanded.value = !expanded.value }, innerModel, expanded })
</script>

<template>
  <div class="x-query-form query-form">
    <el-form ref="formRef" v-bind="$attrs" :model="innerModel" :label-width="labelWidth" size="small" @submit.prevent>
      <el-row v-for="(row, rowIndex) in visibleRows" :key="`query-row-${rowIndex}`" class="query-form__row" :gutter="gutter">
        <el-col v-for="item in row" :key="item.field.prop || item.field.slotName || item.index" :span="item.span">
          <el-form-item :label="item.field.label" :prop="splitRange(item.field) ? startProp(item.field) : item.field.prop">
            <div class="query-form__control" :class="{ 'query-form__control--radio-group': item.field.layout === 'radio-group' }" @keyup="handleKeyup">
              <slot
                v-if="item.field.slotName && $slots[item.field.slotName]"
                :name="item.field.slotName"
                :model="innerModel"
                :field="item.field"
                :value="fieldValue(item.field)"
                :update="(value: unknown) => updateField(item.field, value)"
              />
              <component
                :is="item.field.component || 'el-input'"
                v-else
                :key="`${item.field.prop}-${resetVersion}`"
                v-bind="componentProps(item.field)"
                :model-value="fieldValue(item.field)"
                @update:model-value="updateField(item.field, $event)"
              />
            </div>
          </el-form-item>
        </el-col>
      </el-row>
      <div v-if="showActions || shouldShowToggle" class="query-form__footer">
        <div class="query-form__action-bar">
          <el-button v-if="showActions" type="primary" size="small" :icon="Search" @click="handleQuery">{{ queryText }}</el-button>
          <el-button v-if="showActions" size="small" :icon="Refresh" @click="reset">{{ resetText }}</el-button>
          <el-button v-if="shouldShowToggle" link type="primary" class="query-form__toggle" @click="expanded = !expanded">
            {{ expanded ? collapseText : expandText }}<el-icon><component :is="expanded ? ArrowUp : ArrowDown" /></el-icon>
          </el-button>
        </div>
      </div>
    </el-form>
  </div>
</template>
