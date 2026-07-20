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
