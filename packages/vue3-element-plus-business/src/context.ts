import { inject, type App, type InjectionKey } from 'vue'
import {
  createBusinessContext,
  type BusinessContext,
  type BusinessHostAdapters
} from '@amusite/business-core'

export const businessContextKey: InjectionKey<BusinessContext> = Symbol('amusite-business-context')
const fallbackContext = createBusinessContext()

export function provideBusinessContext(
  app: App,
  adapters: BusinessHostAdapters = {}
): BusinessContext {
  const context = createBusinessContext(adapters)
  app.provide(businessContextKey, context)
  return context
}

export function useBusinessContext(): BusinessContext {
  return inject(businessContextKey, fallbackContext)
}
