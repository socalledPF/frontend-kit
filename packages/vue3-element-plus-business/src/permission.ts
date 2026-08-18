import type { App, Directive, InjectionKey } from 'vue'
import { evaluatePermission } from '@amusite/business-core'
import type {
  PermissionDirectiveValue,
  PermissionProvider,
  PermissionRequirement
} from '@amusite/business-core'

export const permissionProviderKey: InjectionKey<PermissionProvider> = Symbol('amusite-permission')

function normalizeValue(
  value: PermissionDirectiveValue | PermissionRequirement | undefined,
  all = false
): PermissionDirectiveValue {
  if (typeof value === 'string' || Array.isArray(value)) {
    return { permission: value, match: all ? 'all' : 'any' }
  }
  return { ...(value || {}), match: all ? 'all' : value?.match }
}

export function checkPermission(
  options: PermissionDirectiveValue = {},
  provider: PermissionProvider = {}
): boolean {
  return evaluatePermission(options, provider)
}

export function createPermissionDirective(
  provider: PermissionProvider = {}
): Directive<HTMLElement, PermissionDirectiveValue | PermissionRequirement> {
  const displays = new WeakMap<HTMLElement, string>()
  const update = (
    element: HTMLElement,
    binding: {
      value?: PermissionDirectiveValue | PermissionRequirement
      modifiers?: Partial<Record<string, boolean>>
    }
  ) => {
    if (!displays.has(element)) displays.set(element, element.style.display)
    element.style.display = evaluatePermission(
      normalizeValue(binding.value, binding.modifiers?.all),
      provider
    )
      ? displays.get(element) || ''
      : 'none'
  }

  return {
    mounted: update,
    updated: update,
    unmounted(element) {
      displays.delete(element)
    }
  }
}

export const PermissionDirective = createPermissionDirective()

export function providePermission(app: App, provider: PermissionProvider = {}): void {
  app.provide(permissionProviderKey, provider)
}
