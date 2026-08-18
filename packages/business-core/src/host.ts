import type { ExportFile, PermissionProvider } from './types'
import {
  interpolateMessage,
  resolveMessages,
  type BusinessLocaleConfig,
  type BusinessMessageKey
} from './locale'

export type BusinessMaybePromise<T> = T | Promise<T>

export interface BusinessConfirmOptions {
  message: string
  title?: string
  type?: 'info' | 'success' | 'warning' | 'error'
  raw?: Record<string, unknown>
}

export type BusinessConfirmAdapter = (
  options: BusinessConfirmOptions
) => BusinessMaybePromise<boolean>
export type BusinessDownloadAdapter = (file: ExportFile) => BusinessMaybePromise<void>

export interface BusinessErrorContext {
  source: string
  action?: string
  metadata?: Record<string, unknown>
}

export type BusinessNotifyErrorAdapter = (error: unknown, context: BusinessErrorContext) => void

export interface BusinessStorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export interface BusinessTelemetryEvent {
  name: string
  phase?: 'start' | 'success' | 'error' | 'cancel'
  durationMs?: number
  metadata?: Record<string, unknown>
  error?: unknown
}

export type BusinessTelemetryAdapter = (event: BusinessTelemetryEvent) => void

export interface BusinessHostAdapters {
  permission?: PermissionProvider
  confirm?: BusinessConfirmAdapter
  download?: BusinessDownloadAdapter
  notifyError?: BusinessNotifyErrorAdapter
  storage?: BusinessStorageAdapter
  telemetry?: BusinessTelemetryAdapter
  locale?: BusinessLocaleConfig
}

export interface BusinessContext extends BusinessHostAdapters {
  permission: PermissionProvider
  t(key: BusinessMessageKey, params?: Record<string, unknown>): string
}

export function createBusinessContext(adapters: BusinessHostAdapters = {}): BusinessContext {
  const messages = resolveMessages(adapters.locale)
  return {
    ...adapters,
    permission: adapters.permission ?? {},
    t: (key, params) => interpolateMessage(messages[key], params)
  }
}
