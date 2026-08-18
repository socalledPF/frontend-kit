import type {
  BusinessDictOption,
  ImportRequest,
  ImportResult,
  PermissionProvider,
  UploadItem,
  UploadRequest
} from '@amusite/business-core'
import type { DownloadResult, RequestClient } from '@amusite/request'
import type { ApiResponse, PageResult, Recordable, RequestAdapter } from '@amusite/shared'

export interface RuoyiResponse<T = unknown> extends ApiResponse<T> {
  rows?: unknown[]
  total?: number
}

export interface RuoyiRequestAdapterOptions extends RequestAdapter {
  successCode?: RequestAdapter['successCode']
  unauthorizedCodes?: Array<string | number>
}

export function createRuoyiRequestAdapter(
  options: RuoyiRequestAdapterOptions = {}
): RequestAdapter {
  return { successCode: 200, unauthorizedCodes: [401], ...options }
}

export function adaptRuoyiPage<T>(response: unknown): PageResult<T> {
  const source = response && typeof response === 'object' ? (response as Recordable) : {}
  const data = source.data && typeof source.data === 'object' ? (source.data as Recordable) : {}
  const rows = source.rows ?? data.rows ?? source.list ?? data.list ?? []
  const list = Array.isArray(rows) ? (rows as T[]) : []
  const rawTotal = source.total ?? data.total
  const total = Number.isFinite(Number(rawTotal)) ? Number(rawTotal) : list.length
  return { list, total, raw: response }
}

export interface RuoyiUploadOptions {
  url?: string
  mapResponse?: (response: unknown, file: File) => UploadItem
}

function appendFormData(form: FormData, values: Record<string, unknown>) {
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value))
      value.forEach((item) => form.append(key, item instanceof Blob ? item : String(item)))
    else
      form.append(
        key,
        value instanceof Blob
          ? value
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value)
      )
  })
}

function defaultUploadMap(response: unknown, file: File): UploadItem {
  const source = response && typeof response === 'object' ? (response as Recordable) : {}
  const data = source.data && typeof source.data === 'object' ? (source.data as Recordable) : source
  return {
    id: data.id as string | number | undefined,
    name: String(data.originalFilename ?? data.fileName ?? data.newFileName ?? file.name),
    url: data.url ? String(data.url) : undefined,
    size: file.size,
    type: file.type,
    meta: { response }
  }
}

export function createRuoyiUploadRequest(
  client: RequestClient,
  options: RuoyiUploadOptions = {}
): UploadRequest {
  return async ({ file, fieldName, data, signal, onProgress }) => {
    const form = new FormData()
    form.append(fieldName, file)
    appendFormData(form, data)
    const response = await client.post(options.url ?? '/common/upload', form, {
      signal,
      onUploadProgress: (event) => onProgress(event.total ? (event.loaded / event.total) * 100 : 0)
    })
    return (options.mapResponse ?? defaultUploadMap)(response, file)
  }
}

export interface RuoyiImportOptions<Result extends ImportResult = ImportResult> {
  url: string
  updateExistingField?: string
  mapResponse?: (response: unknown) => Result
}

export function createRuoyiImportRequest<Result extends ImportResult = ImportResult>(
  client: RequestClient,
  options: RuoyiImportOptions<Result>
): ImportRequest<Result> {
  return async ({ file, fieldName, data, updateExisting, signal, onProgress }) => {
    const form = new FormData()
    form.append(fieldName, file)
    form.append(options.updateExistingField ?? 'updateSupport', String(updateExisting))
    appendFormData(form, data)
    const response = await client.post(options.url, form, {
      signal,
      onUploadProgress: (event) => onProgress(event.total ? (event.loaded / event.total) * 100 : 0)
    })
    return options.mapResponse ? options.mapResponse(response) : (response as Result)
  }
}

export interface RuoyiExportOptions {
  fileName?: string
  method?: 'get' | 'post'
}

export function createRuoyiExportRequest(
  client: RequestClient,
  url: string,
  options: RuoyiExportOptions = {}
) {
  return async (data?: unknown) => {
    const result: DownloadResult<Blob> =
      options.method === 'get'
        ? await client.download(url, { params: data })
        : await client.downloadPost(url, data)
    return { data: result.data, fileName: result.fileName || options.fileName || 'export.xlsx' }
  }
}

export interface RuoyiDictRecord extends Recordable {
  dictLabel?: string
  dictValue?: string | number
  listClass?: string
  cssClass?: string
  status?: string
}

export function createRuoyiDictLoader(
  client: RequestClient,
  url = '/system/dict/data/type/{type}'
) {
  return async (type: string): Promise<BusinessDictOption[]> => {
    const response = await client.get<unknown>(url.replace('{type}', encodeURIComponent(type)))
    const records = Array.isArray(response)
      ? response
      : Array.isArray((response as Recordable | undefined)?.data)
        ? ((response as Recordable).data as unknown[])
        : []
    return records.map((raw) => {
      const item = raw as RuoyiDictRecord
      return {
        label: String(item.dictLabel ?? ''),
        value: item.dictValue ?? '',
        type: item.listClass,
        className: item.cssClass,
        disabled: item.status === '1',
        raw
      }
    })
  }
}

export function createRuoyiPermissionProvider(options: {
  getPermissions?: () => readonly string[] | undefined
  getRoles?: () => readonly string[] | undefined
  superPermission?: string
  superRole?: string
}): PermissionProvider {
  return {
    getPermissions: options.getPermissions,
    getRoles: options.getRoles,
    superPermissions: [options.superPermission ?? '*:*:*'],
    superRoles: [options.superRole ?? 'admin']
  }
}
