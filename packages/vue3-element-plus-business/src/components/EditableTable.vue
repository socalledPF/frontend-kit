<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import {
  cloneValue,
  type EditableTableChangeDetail,
  type EditableTableColumn
} from '@amusite/business-core'
import { useBusinessContext } from '../context'

type Row = Record<string, unknown>
const props = withDefaults(
  defineProps<{
    modelValue?: Row[]
    columns?: EditableTableColumn<Row>[]
    rowKey?: string | ((row: Row) => string | number)
    editMode?: 'cell' | 'row' | 'all'
    createRow?: () => Row
    addable?: boolean
    removable?: boolean
    disabled?: boolean
    maxRows?: number
    minRows?: number
    size?: string
    border?: boolean
    stripe?: boolean
  }>(),
  {
    modelValue: () => [],
    columns: () => [],
    rowKey: 'id',
    editMode: 'all',
    createRow: () => ({}),
    addable: true,
    removable: true,
    disabled: false,
    maxRows: 0,
    minRows: 0,
    size: 'small',
    border: true,
    stripe: false
  }
)
const emit = defineEmits<{
  'update:modelValue': [rows: Row[]]
  change: [rows: Row[], detail: EditableTableChangeDetail<Row>]
  add: [row: Row, index: number]
  remove: [row: Row, index: number]
  'validation-error': [rows: Row[]]
}>()
defineSlots<{
  empty?: () => unknown
  append?: (scope: { addRow: () => void; rows: Row[] }) => unknown
  actions?: (scope: { row: Row; index: number; remove: () => void }) => unknown
  [key: string]: ((scope: any) => unknown) | undefined
}>()
const business = useBusinessContext()
const formRef = ref<{
  validate?: (callback: (valid: boolean) => void) => void
  clearValidate?: () => void
}>()
const innerRows = ref<Row[]>(cloneValue(props.modelValue))
const editingRows = ref(new Set<string | number>())
const editingCell = ref('')
let syncing = false
watch(
  () => props.modelValue,
  (rows) => {
    if (!syncing) innerRows.value = cloneValue(rows)
  },
  { deep: true }
)
function keyOf(row: Row, index: number) {
  return typeof props.rowKey === 'function'
    ? props.rowKey(row)
    : ((row[props.rowKey] as string | number | undefined) ?? index)
}
function emitRows(detail: EditableTableChangeDetail<Row>) {
  const rows = cloneValue(innerRows.value)
  syncing = true
  emit('update:modelValue', rows)
  emit('change', rows, detail)
  void nextTick(() => {
    syncing = false
  })
}
function canEdit(column: EditableTableColumn<Row>, row: Row, index: number) {
  return (
    !props.disabled &&
    (typeof column.editable === 'function'
      ? column.editable(row, index)
      : column.editable !== false)
  )
}
function isEditing(column: EditableTableColumn<Row>, row: Row, index: number) {
  if (!canEdit(column, row, index)) return false
  if (props.editMode === 'all') return true
  const key = keyOf(row, index)
  return props.editMode === 'row'
    ? editingRows.value.has(key)
    : editingCell.value === `${key}:${column.prop}`
}
function startEdit(row: Row, index: number, prop?: string) {
  const key = keyOf(row, index)
  if (props.editMode === 'row') {
    const next = new Set(editingRows.value)
    next.add(key)
    editingRows.value = next
  } else if (props.editMode === 'cell' && prop) editingCell.value = `${key}:${prop}`
}
function stopEdit(row?: Row, index = 0) {
  if (!row) {
    editingRows.value = new Set()
    editingCell.value = ''
    return
  }
  const key = keyOf(row, index)
  const next = new Set(editingRows.value)
  next.delete(key)
  editingRows.value = next
  if (editingCell.value.startsWith(`${key}:`)) editingCell.value = ''
}
function updateCell(row: Row, index: number, prop: string, value: unknown) {
  const previousValue = row[prop]
  row[prop] = value
  emitRows({ type: 'edit', row: cloneValue(row), index, prop, previousValue, value })
}
function updateColumnCell(
  row: Row,
  index: number,
  column: EditableTableColumn<Row>,
  value: unknown
) {
  if (column.prop) updateCell(row, index, column.prop, value)
}
function handleCellClick(row: Row, column: { property?: string }) {
  startEdit(row, innerRows.value.indexOf(row), column.property)
}
function editorProps(column: EditableTableColumn<Row>, row: Row, index: number) {
  return typeof column.editorProps === 'function'
    ? column.editorProps(row, index)
    : column.editorProps || {}
}
function addRow() {
  if (props.disabled || (props.maxRows > 0 && innerRows.value.length >= props.maxRows)) return
  const row = cloneValue(props.createRow())
  innerRows.value.push(row)
  const index = innerRows.value.length - 1
  emitRows({ type: 'add', row: cloneValue(row), index })
  emit('add', cloneValue(row), index)
}
function removeRow(index: number) {
  if (props.disabled || innerRows.value.length <= props.minRows) return
  const [row] = innerRows.value.splice(index, 1)
  emitRows({ type: 'remove', row: cloneValue(row), index })
  emit('remove', cloneValue(row), index)
}
function validate(): Promise<boolean> {
  if (!formRef.value?.validate) return Promise.resolve(true)
  return new Promise((resolve) =>
    formRef.value?.validate?.((valid) => {
      if (!valid) emit('validation-error', cloneValue(innerRows.value))
      resolve(valid)
    })
  )
}
function reset(rows: Row[] = props.modelValue) {
  innerRows.value = cloneValue(rows)
  stopEdit()
  formRef.value?.clearValidate?.()
  emitRows({ type: 'reset' })
}
defineExpose({ rows: innerRows, addRow, removeRow, startEdit, stopEdit, validate, reset })
</script>

<template>
  <div class="x-editable-table">
    <el-form ref="formRef" :model="innerRows" class="x-editable-table__form">
      <el-table
        v-bind="$attrs"
        :data="innerRows"
        :row-key="rowKey as any"
        :size="size as any"
        :border="border"
        :stripe="stripe"
        @cell-click="handleCellClick"
      >
        <el-table-column
          v-for="column in columns"
          :key="String(column.key || column.prop || column.label)"
          v-bind="column"
          :prop="column.prop"
          :label="column.label"
        >
          <template #default="{ row, $index }">
            <template v-if="column.prop && isEditing(column, row, $index)">
              <el-form-item
                class="x-editable-table__form-item"
                :prop="`${$index}.${column.prop}`"
                :rules="column.rules as any"
              >
                <slot
                  :name="column.editorSlotName || `editor-${column.prop}`"
                  :row="row"
                  :index="$index"
                  :column="column"
                  :value="row[column.prop]"
                  :update="(value: unknown) => updateColumnCell(row, $index, column, value)"
                >
                  <component
                    :is="column.editor || 'el-input'"
                    v-bind="editorProps(column, row, $index)"
                    :aria-label="column.label || column.prop"
                    :model-value="row[column.prop]"
                    @update:model-value="updateColumnCell(row, $index, column, $event)"
                  />
                </slot>
              </el-form-item>
            </template>
            <slot
              v-else
              :name="column.slotName || `cell-${column.prop}`"
              :row="row"
              :index="$index"
              :column="column"
              :value="column.prop ? row[column.prop] : undefined"
              >{{ column.prop ? row[column.prop] : '' }}</slot
            >
          </template>
        </el-table-column>
        <el-table-column v-if="removable || $slots.actions" fixed="right" width="72" align="center">
          <template #default="{ row, $index }"
            ><slot name="actions" :row="row" :index="$index" :remove="() => removeRow($index)"
              ><el-button
                v-if="removable"
                link
                type="danger"
                :icon="Delete"
                :disabled="disabled || innerRows.length <= minRows"
                :aria-label="business.t('common.remove')"
                @click.stop="removeRow($index)" /></slot
          ></template>
        </el-table-column>
        <template v-if="$slots.empty" #empty><slot name="empty" /></template>
      </el-table>
    </el-form>
    <div v-if="addable || $slots.append" class="x-editable-table__append">
      <slot name="append" :add-row="addRow" :rows="innerRows"
        ><el-button
          v-if="addable"
          plain
          :icon="Plus"
          :disabled="disabled || (maxRows > 0 && innerRows.length >= maxRows)"
          @click="addRow"
          >{{ business.t('editable.addRow') }}</el-button
        ></slot
      >
    </div>
  </div>
</template>
