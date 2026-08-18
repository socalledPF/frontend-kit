import type { Vue } from 'vue/types/vue'
import type { VueConstructor } from 'vue'
import {
  createBusinessContext,
  type BusinessContext,
  type BusinessHostAdapters,
  type BusinessMessageKey
} from '@amusite/business-core'

const fallbackContext = createBusinessContext()

declare module 'vue/types/vue' {
  interface Vue {
    $amusiteBusiness?: BusinessContext
    $amusiteT?: (key: BusinessMessageKey, params?: Record<string, unknown>) => string
  }
}

export function installBusinessContext(
  VueType: VueConstructor,
  adapters: BusinessHostAdapters = {}
): BusinessContext {
  const context = createBusinessContext(adapters)
  if (VueType.prototype) {
    VueType.prototype.$amusiteBusiness = context
    VueType.prototype.$amusiteT = context.t
  }
  return context
}

export function getBusinessContext(vm?: Vue): BusinessContext {
  return vm?.$amusiteBusiness ?? fallbackContext
}

export function translate(
  vm: Vue | undefined,
  key: BusinessMessageKey,
  params?: Record<string, unknown>
): string {
  return getBusinessContext(vm).t(key, params)
}
