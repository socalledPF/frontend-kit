import { ref, type Ref } from 'vue-demi'
import {
  cloneValue,
  createSchemaModel,
  schemaToDescriptions,
  schemaToFormFields,
  schemaToQueryFields,
  schemaToTableColumns,
  type BusinessFieldSchema,
  type BusinessFormField,
  type DescriptionItem,
  type FormDialogMode,
  type ProTableColumn,
  type QueryFormField
} from '@amusite/business-core'
import type { Recordable } from '@amusite/shared'
import { useAsyncAction, type UseAsyncActionReturn } from './useAsyncAction'
import { useModal, type UseModalReturn } from './useModal'
import { useSelection, type SelectionKey, type UseSelectionReturn } from './useSelection'
import { useTable, type UseTableOptions, type UseTableReturn } from './useTable'

export interface UseCrudPageOptions<
  Row extends object,
  Query extends object = Recordable,
  SaveResult = unknown,
  RemoveResult = unknown
> {
  schema: BusinessFieldSchema[]
  table: UseTableOptions<Row, Query>
  rowKey?: (row: Row) => SelectionKey
  createModel?: () => Record<string, unknown>
  save?: (
    model: Record<string, unknown>,
    mode: Exclude<FormDialogMode, 'view'>,
    source?: Row
  ) => Promise<SaveResult> | SaveResult
  remove?: (rows: Row[]) => Promise<RemoveResult> | RemoveResult
  refreshAfterSave?: boolean
  refreshAfterRemove?: boolean
  onError?: (error: unknown, action: 'save' | 'remove') => void
}

export interface UseCrudPageReturn<
  Row extends object,
  Query extends object,
  SaveResult,
  RemoveResult
> {
  schema: BusinessFieldSchema[]
  queryFields: QueryFormField[]
  tableColumns: ProTableColumn[]
  formFields: BusinessFormField[]
  descriptionItems: DescriptionItem[]
  table: UseTableReturn<Row, Query>
  modal: UseModalReturn<Row, FormDialogMode>
  selection: UseSelectionReturn<Row>
  formModel: Ref<Record<string, unknown>>
  openCreate: () => void
  openEdit: (row: Row) => void
  openView: (row: Row) => void
  submit: (model?: Record<string, unknown>) => Promise<SaveResult | undefined>
  removeRows: (rows?: Row[]) => Promise<RemoveResult | undefined>
  saveAction: UseAsyncActionReturn<
    SaveResult,
    [Record<string, unknown>, Exclude<FormDialogMode, 'view'>, Row | undefined]
  >
  removeAction: UseAsyncActionReturn<RemoveResult, [Row[]]>
}

export function useCrudPage<
  Row extends object,
  Query extends object = Recordable,
  SaveResult = unknown,
  RemoveResult = unknown
>(
  options: UseCrudPageOptions<Row, Query, SaveResult, RemoveResult>
): UseCrudPageReturn<Row, Query, SaveResult, RemoveResult> {
  const table = useTable(options.table)
  const modal = useModal<Row, FormDialogMode>('create')
  const selection = useSelection<Row>(options.rowKey)
  const formModel = ref<Record<string, unknown>>({}) as Ref<Record<string, unknown>>
  const makeModel = (source?: Row) =>
    source
      ? createSchemaModel(options.schema, source as Record<string, unknown>)
      : { ...createSchemaModel(options.schema), ...(options.createModel?.() ?? {}) }

  const saveAction = useAsyncAction<
    SaveResult,
    [Record<string, unknown>, Exclude<FormDialogMode, 'view'>, Row | undefined]
  >({
    action: async (model, mode, source) => {
      if (!options.save) return undefined as SaveResult
      const result = await options.save(cloneValue(model), mode, source)
      if (options.refreshAfterSave ?? true) await table.refresh()
      modal.close(true)
      return result
    },
    onError: (error) => options.onError?.(error, 'save')
  })

  const removeAction = useAsyncAction<RemoveResult, [Row[]]>({
    action: async (rows) => {
      if (!options.remove) return undefined as RemoveResult
      const result = await options.remove([...rows])
      selection.clear()
      if (options.refreshAfterRemove ?? true) await table.refresh()
      return result
    },
    onError: (error) => options.onError?.(error, 'remove')
  })

  const open = (mode: FormDialogMode, source?: Row) => {
    formModel.value = makeModel(source)
    modal.open(source, mode)
  }

  return {
    schema: options.schema,
    queryFields: schemaToQueryFields(options.schema),
    tableColumns: schemaToTableColumns(options.schema),
    formFields: schemaToFormFields(options.schema),
    descriptionItems: schemaToDescriptions(options.schema),
    table,
    modal,
    selection,
    formModel,
    openCreate: () => open('create'),
    openEdit: (row) => open('edit', row),
    openView: (row) => open('view', row),
    submit: (model = formModel.value) => {
      if (modal.mode.value === 'view') return Promise.resolve(undefined)
      return saveAction.execute(model, modal.mode.value, modal.payload.value)
    },
    removeRows: (rows = selection.selected.value) =>
      rows.length ? removeAction.execute(rows) : Promise.resolve(undefined),
    saveAction,
    removeAction
  }
}
