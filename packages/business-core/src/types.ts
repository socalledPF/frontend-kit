export type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface QueryFormField {
  prop: string
  label?: string
  component?: string | object
  componentProps?: Record<string, unknown>
  colSpan?: number
  visible?: boolean
  slotName?: string
  valueMode?: 'split-range' | string
  startProp?: string
  endProp?: string
  layout?: 'radio-group' | string
  [key: string]: unknown
}

export type QueryFormModel = Record<string, unknown>
export type QueryFormBreakpointCols = Partial<Record<BreakpointKey, number>>

export interface ProTableColumn {
  prop?: string
  type?: string
  label?: string
  visible?: boolean
  slotName?: string
  headerSlotName?: string
  columnSetting?: unknown
  key?: string | number
  showOverflowTooltip?: boolean
  [key: string]: unknown
}

export interface PaginationPayload {
  page: number
  limit: number
}

export type LoadingSize = 'small' | 'medium' | 'large'

export interface LoadingProps {
  loading?: boolean
  text?: string
  fullscreen?: boolean
  lock?: boolean
  delay?: number
  minDuration?: number
  background?: string
  spinnerClass?: string
  maskClass?: string
  size?: LoadingSize
  zIndex?: number
}

export type UploadMode = 'file' | 'image'
export type UploadStatus = 'ready' | 'queued' | 'uploading' | 'success' | 'error'

export interface UploadItem {
  uid?: string
  id?: string | number
  name: string
  url?: string
  size?: number
  type?: string
  meta?: Record<string, unknown>
}

export interface UploadFileState {
  uid: string
  name: string
  url?: string
  size?: number
  type?: string
  status: UploadStatus
  percentage: number
  file?: File
  item?: UploadItem
  error?: unknown
  errorMessage?: string
}

export interface UploadRequestContext {
  file: File
  fieldName: string
  data: Record<string, unknown>
  signal?: AbortSignal
  onProgress: (percent: number) => void
}

export type UploadRequest = (context: UploadRequestContext) => Promise<UploadItem>
export type UploadData = Record<string, unknown> | ((file: File) => Record<string, unknown>)
export type UploadBeforeUpload = (
  file: File,
  currentValue: UploadItem[]
) => boolean | Promise<boolean>
export type UploadBeforeRemove = (
  file: UploadFileState,
  currentValue: UploadItem[]
) => boolean | Promise<boolean>
export type UploadValidationErrorCode =
  'limit' | 'type' | 'size' | 'duplicate' | 'before-upload' | 'config'

export interface UploadValidationError {
  code: UploadValidationErrorCode
  message: string
  file?: File
  error?: unknown
}

export type UploadChangeType = 'select' | 'success' | 'remove' | 'clear'

export interface UploadChangeDetail {
  type: UploadChangeType
  file?: UploadFileState
  item?: UploadItem
}

export type AsyncButtonConfirm =
  string | boolean | ((...args: unknown[]) => boolean | Promise<boolean>)

export type DictValue = string | number

export interface BusinessDictOption<Value extends DictValue = DictValue> {
  label: string
  value: Value
  disabled?: boolean
  type?: string
  color?: string
  className?: string
  raw?: unknown
  [key: string]: unknown
}

export type TableDensity = 'medium' | 'small' | 'mini'

export interface TableToolbarPreferences {
  density?: TableDensity
  columns?: Record<string, boolean>
}

export type FormDialogMode = 'create' | 'edit' | 'view'

export interface FormDialogSubmitContext<
  Model extends Record<string, unknown> = Record<string, unknown>
> {
  mode: FormDialogMode
  model: Model
}

export type FormDialogSubmit<
  Model extends Record<string, unknown> = Record<string, unknown>,
  Result = unknown
> = (model: Model, context: FormDialogSubmitContext<Model>) => Result | Promise<Result>

export interface FormDialogCloseContext<
  Model extends Record<string, unknown> = Record<string, unknown>
> {
  mode: FormDialogMode
  model: Model
  dirty: boolean
  submitting: boolean
  reason: 'cancel' | 'close' | 'success'
}

export type FormDialogBeforeClose<Model extends Record<string, unknown> = Record<string, unknown>> =
  (context: FormDialogCloseContext<Model>) => boolean | Promise<boolean>

export type PermissionRequirement = string | string[]
export type PermissionMatchMode = 'any' | 'all'

export interface PermissionCheckContext {
  permission?: PermissionRequirement
  roles?: PermissionRequirement
  match: PermissionMatchMode
  permissions: string[]
  currentRoles: string[]
}

export type PermissionChecker = (context: PermissionCheckContext) => boolean

export interface PermissionProvider {
  getPermissions?: () => readonly string[] | undefined
  getRoles?: () => readonly string[] | undefined
  check?: PermissionChecker
  superPermissions?: readonly string[]
  superRoles?: readonly string[]
}

export interface PermissionDirectiveValue {
  permission?: PermissionRequirement
  roles?: PermissionRequirement
  match?: PermissionMatchMode
  checker?: PermissionChecker
}

export interface DescriptionItem<Row extends object = Record<string, unknown>> {
  prop: string
  label?: string
  span?: number
  visible?: boolean
  slotName?: string
  labelSlotName?: string
  emptyText?: string
  dictOptions?: BusinessDictOption[]
  formatter?: (value: unknown, row: Row, item: DescriptionItem<Row>) => unknown
  width?: string | number
  minWidth?: string | number
  align?: 'left' | 'center' | 'right'
  labelAlign?: 'left' | 'center' | 'right'
  className?: string
  labelClassName?: string
  [key: string]: unknown
}

export interface ImportResultError {
  row?: number
  field?: string
  message: string
  data?: unknown
}

export interface ImportResult<Data = unknown> {
  successCount?: number
  failureCount?: number
  message?: string
  errors?: ImportResultError[]
  data?: Data
}

export interface ImportRequestContext {
  file: File
  fieldName: string
  data: Record<string, unknown>
  updateExisting: boolean
  signal?: AbortSignal
  onProgress: (percent: number) => void
}

export type ImportRequest<Result extends ImportResult = ImportResult> = (
  context: ImportRequestContext
) => Promise<Result>

export type ImportData =
  Record<string, unknown> | ((file: File, updateExisting: boolean) => Record<string, unknown>)

export type ImportValidationErrorCode = 'type' | 'size' | 'before-import' | 'config'

export interface ImportValidationError {
  code: ImportValidationErrorCode
  message: string
  file?: File
  error?: unknown
}

export interface ExportFile {
  data: Blob | ArrayBuffer | string
  fileName?: string
  type?: string
}

export type ExportResult = Blob | ArrayBuffer | string | ExportFile

export interface RemoteSelectRequestContext {
  keyword: string
  requestId: number
  signal?: AbortSignal
}

export type RemoteSelectRequest<Value extends DictValue = DictValue> = (
  keyword: string,
  context: RemoteSelectRequestContext
) => Promise<BusinessDictOption<Value>[]>

export interface EditableTableColumn<
  Row extends object = Record<string, unknown>
> extends ProTableColumn {
  editable?: boolean | ((row: Row, index: number) => boolean)
  editor?: string | object
  editorProps?: Record<string, unknown> | ((row: Row, index: number) => Record<string, unknown>)
  rules?: unknown[]
  editorSlotName?: string
}

export type EditableTableChangeType = 'add' | 'remove' | 'edit' | 'reset'

export interface EditableTableChangeDetail<Row extends object = Record<string, unknown>> {
  type: EditableTableChangeType
  row?: Row
  index?: number
  prop?: string
  previousValue?: unknown
  value?: unknown
}

export type FilePreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'unsupported'

export interface FilePreviewItem extends UploadItem {
  data?: Blob | ArrayBuffer | string
}
