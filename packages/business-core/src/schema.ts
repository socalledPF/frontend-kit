import type { DescriptionItem, ProTableColumn, QueryFormField } from './types'

export interface BusinessFormField {
  prop: string
  label?: string
  component?: string | object
  componentProps?: Record<string, unknown>
  rules?: unknown[]
  visible?: boolean
  slotName?: string
  colSpan?: number
  [key: string]: unknown
}

export interface BusinessFieldSchema {
  prop: string
  label: string
  defaultValue?: unknown
  query?: boolean | Omit<QueryFormField, 'prop' | 'label'>
  table?: boolean | Omit<ProTableColumn, 'prop' | 'label'>
  form?: boolean | Omit<BusinessFormField, 'prop' | 'label'>
  detail?: boolean | Omit<DescriptionItem, 'prop' | 'label'>
}

function resolveFacet<T extends object>(value: boolean | T | undefined): T | undefined {
  if (!value) return undefined
  return value === true ? ({} as T) : value
}

export function schemaToQueryFields(schema: BusinessFieldSchema[]): QueryFormField[] {
  return schema.flatMap((field) => {
    const options = resolveFacet(field.query)
    return options ? [{ prop: field.prop, label: field.label, ...options }] : []
  })
}

export function schemaToTableColumns(schema: BusinessFieldSchema[]): ProTableColumn[] {
  return schema.flatMap((field) => {
    const options = resolveFacet(field.table)
    return options ? [{ prop: field.prop, label: field.label, ...options }] : []
  })
}

export function schemaToFormFields(schema: BusinessFieldSchema[]): BusinessFormField[] {
  return schema.flatMap((field) => {
    const options = resolveFacet(field.form)
    return options ? [{ prop: field.prop, label: field.label, ...options }] : []
  })
}

export function schemaToDescriptions(schema: BusinessFieldSchema[]): DescriptionItem[] {
  return schema.flatMap((field) => {
    const options = resolveFacet(field.detail)
    return options ? [{ prop: field.prop, label: field.label, ...options }] : []
  })
}

export function createSchemaModel(
  schema: BusinessFieldSchema[],
  source: Record<string, unknown> = {}
) {
  return Object.fromEntries(
    schema.map((field) => [field.prop, source[field.prop] ?? field.defaultValue])
  )
}
