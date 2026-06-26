export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}

export function isEmpty(value: unknown): boolean {
  if (value == null) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size === 0
  }

  if (isPlainObject(value)) {
    return Object.keys(value).length === 0
  }

  return false
}

export function safeJsonParse<T = unknown>(value: string): T | undefined
export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T
export function safeJsonParse<T>(
  value: string | null | undefined,
  fallback?: T
): T | undefined {
  if (typeof value !== 'string') {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
