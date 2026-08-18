import type {
  PermissionCheckContext,
  PermissionDirectiveValue,
  PermissionMatchMode,
  PermissionProvider,
  PermissionRequirement,
  UploadItem
} from './types'
import { zhCN } from './locale'

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function cloneValue<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as T
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T
  if (isPlainObject(value)) {
    return Object.keys(value).reduce<Record<string, unknown>>((result, key) => {
      result[key] = cloneValue(value[key])
      return result
    }, {}) as T
  }
  return value
}

export function isEqualValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime()
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((item, index) => isEqualValue(item, right[index]))
    )
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) && isEqualValue(left[key], right[key])
      )
    )
  }
  return false
}

export function getByPath(source: unknown, path: string): unknown {
  if (!path) return source
  return path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((value, key) => {
      if (!value || typeof value !== 'object') return undefined
      return (value as Record<string, unknown>)[key]
    }, source)
}

export function clampPercentage(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0
}

export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  return index >= 0 ? fileName.slice(index).toLowerCase() : ''
}

export function matchesFileAccept(file: Pick<File, 'name' | 'type'>, accept: string): boolean {
  const rules = accept
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  if (rules.length === 0) return true
  const extension = getFileExtension(file.name)
  const type = (file.type || '').toLowerCase()
  return rules.some((rule) => {
    if (rule === '*/*') return true
    if (rule.startsWith('.')) return extension === rule
    if (rule.endsWith('/*')) {
      if (type.startsWith(rule.slice(0, -1))) return true
      return (
        rule === 'image/*' &&
        [
          '.apng',
          '.avif',
          '.bmp',
          '.gif',
          '.ico',
          '.jpeg',
          '.jpg',
          '.png',
          '.svg',
          '.webp'
        ].includes(extension)
      )
    }
    return type === rule
  })
}

export function formatFileSize(size = 0): string {
  if (size <= 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function getErrorMessage(error: unknown, fallback = zhCN['common.operationFailed']): string {
  if (error instanceof Error && error.message) return error.message
  return typeof error === 'string' && error ? error : fallback
}

export function cloneUploadItem(item: UploadItem): UploadItem {
  return { ...item, meta: item.meta ? { ...item.meta } : undefined }
}

export function normalizeUploadItem(result: unknown, file: File, uid: string): UploadItem {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error(zhCN['upload.invalidResponse'])
  }
  const item = result as UploadItem
  return {
    ...item,
    uid: item.uid || uid,
    name: item.name || file.name,
    size: item.size ?? file.size,
    type: item.type || file.type || undefined,
    meta: item.meta ? { ...item.meta } : undefined
  }
}

export function toPermissionValues(value?: PermissionRequirement | readonly string[]): string[] {
  if (!value) return []
  return (Array.isArray(value) ? value : [value]).map((item) => String(item).trim()).filter(Boolean)
}

function matchesRequirement(
  requirement: PermissionRequirement | undefined,
  available: string[],
  match: PermissionMatchMode
): boolean {
  const expected = toPermissionValues(requirement)
  if (expected.length === 0) return true
  return match === 'all'
    ? expected.every((item) => available.includes(item))
    : expected.some((item) => available.includes(item))
}

export function evaluatePermission(
  options: PermissionDirectiveValue = {},
  provider: PermissionProvider = {}
): boolean {
  const match = options.match === 'all' ? 'all' : 'any'
  const permissions = toPermissionValues(provider.getPermissions?.())
  const currentRoles = toPermissionValues(provider.getRoles?.())
  const context: PermissionCheckContext = {
    permission: options.permission,
    roles: options.roles,
    match,
    permissions,
    currentRoles
  }
  const checker = options.checker || provider.check
  if (checker) return checker(context)

  const superPermissions = toPermissionValues(provider.superPermissions || ['*:*:*'])
  const superRoles = toPermissionValues(provider.superRoles || ['admin'])
  const permissionGranted =
    !options.permission ||
    superPermissions.some((item) => permissions.includes(item)) ||
    matchesRequirement(options.permission, permissions, match)
  const roleGranted =
    !options.roles ||
    superRoles.some((item) => currentRoles.includes(item)) ||
    matchesRequirement(options.roles, currentRoles, match)
  return permissionGranted && roleGranted
}
