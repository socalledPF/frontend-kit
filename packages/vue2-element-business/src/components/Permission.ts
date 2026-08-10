import Vue, {
  type CreateElement,
  type DirectiveOptions,
  type VNode,
  type VNodeDirective
} from 'vue'
import type {
  PermissionCheckContext,
  PermissionChecker,
  PermissionDirectiveValue,
  PermissionMatchMode,
  PermissionProvider,
  PermissionRequirement
} from '../types'

const DEFAULT_PROVIDER: PermissionProvider = {}
const originalDisplay = new WeakMap<HTMLElement, string>()
let permissionProvider: PermissionProvider = DEFAULT_PROVIDER

function toValues(value?: PermissionRequirement | readonly string[]): string[] {
  if (!value) {
    return []
  }

  return (Array.isArray(value) ? value : [value]).map((item) => String(item).trim()).filter(Boolean)
}

function matchesRequirement(
  requirement: PermissionRequirement | undefined,
  available: string[],
  match: PermissionMatchMode
): boolean {
  const expected = toValues(requirement)
  if (expected.length === 0) {
    return true
  }

  return match === 'all'
    ? expected.every((item) => available.includes(item))
    : expected.some((item) => available.includes(item))
}

export function configurePermission(provider: PermissionProvider = DEFAULT_PROVIDER): void {
  permissionProvider = provider
}

export function checkPermission(
  options: PermissionDirectiveValue = {},
  provider: PermissionProvider = permissionProvider
): boolean {
  const match = options.match === 'all' ? 'all' : 'any'
  const permissions = toValues(provider.getPermissions?.())
  const currentRoles = toValues(provider.getRoles?.())
  const context: PermissionCheckContext = {
    permission: options.permission,
    roles: options.roles,
    match,
    permissions,
    currentRoles
  }
  const checker = options.checker || provider.check

  if (checker) {
    return checker(context)
  }

  const superPermissions = toValues(provider.superPermissions || ['*:*:*'])
  const superRoles = toValues(provider.superRoles || ['admin'])
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

function normalizeDirectiveValue(binding: VNodeDirective): PermissionDirectiveValue {
  const value = binding.value as PermissionDirectiveValue | PermissionRequirement | undefined

  if (typeof value === 'string' || Array.isArray(value)) {
    return {
      permission: value,
      match: binding.modifiers?.all ? 'all' : 'any'
    }
  }

  return {
    ...(value || {}),
    match: binding.modifiers?.all ? 'all' : value?.match
  }
}

function updateDirectiveVisibility(element: HTMLElement, binding: VNodeDirective): void {
  if (!originalDisplay.has(element)) {
    originalDisplay.set(element, element.style.display)
  }

  element.style.display = checkPermission(normalizeDirectiveValue(binding))
    ? originalDisplay.get(element) || ''
    : 'none'
}

export const PermissionDirective: DirectiveOptions = {
  inserted(element, binding) {
    updateDirectiveVisibility(element as HTMLElement, binding)
  },
  componentUpdated(element, binding) {
    updateDirectiveVisibility(element as HTMLElement, binding)
  },
  unbind(element) {
    originalDisplay.delete(element as HTMLElement)
  }
}

export default Vue.extend({
  name: 'Permission',
  props: {
    permission: {
      type: [String, Array],
      default: undefined
    },
    roles: {
      type: [String, Array],
      default: undefined
    },
    match: {
      type: String,
      default: 'any',
      validator: (value: string) => ['any', 'all'].includes(value)
    },
    checker: {
      type: Function,
      default: undefined
    },
    tag: {
      type: String,
      default: 'span'
    }
  },
  computed: {
    allowed(this: any): boolean {
      return checkPermission({
        permission: this.permission,
        roles: this.roles,
        match: this.match as PermissionMatchMode,
        checker: this.checker as PermissionChecker | undefined
      })
    }
  },
  render(this: any, h: CreateElement): VNode {
    const scope = {
      allowed: this.allowed,
      permission: this.permission,
      roles: this.roles
    }

    if (!this.allowed) {
      const fallback = this.$scopedSlots.fallback?.(scope) || this.$slots.fallback
      return fallback?.length === 1
        ? fallback[0]
        : h(this.tag, { class: 'x-permission x-permission--hidden' }, fallback)
    }

    const content = this.$scopedSlots.default?.(scope) || this.$slots.default || []
    return content.length === 1 ? content[0] : h(this.tag, { class: 'x-permission' }, content)
  }
})
