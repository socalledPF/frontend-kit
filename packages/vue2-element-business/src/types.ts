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
  | 'limit'
  | 'type'
  | 'size'
  | 'duplicate'
  | 'before-upload'
  | 'config'

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
  | string
  | boolean
  | ((...args: unknown[]) => boolean | Promise<boolean>)

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
